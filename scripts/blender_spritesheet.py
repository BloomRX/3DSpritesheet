"""Render a verified 3D input to a PNG atlas and metadata using Blender's Python API.

This adapter does not generate a model from text. It consumes an existing .blend,
.glb/.gltf, .fbx, .obj or .stl file and renders it in a clean background process.
"""
from __future__ import annotations

import argparse
import array
import json
import math
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path


def report(message: str, percent: int | None = None) -> None:
    if percent is None:
        print(f"LIA_FORGE: {message}", flush=True)
    else:
        print(f"LIA_FORGE_PROGRESS {max(0, min(100, int(percent)))} {message}", flush=True)


def parse_args(argv: list[str]) -> argparse.Namespace:
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--asset-name", required=True)
    parser.add_argument("--asset-type", required=True, choices=("character", "item"))
    parser.add_argument("--frame-width", required=True, type=int)
    parser.add_argument("--frame-height", required=True, type=int)
    parser.add_argument("--animations-json", default="[]")
    parser.add_argument("--turntable-frames", type=int, default=8)
    args = parser.parse_args(argv)
    if not args.input.is_file() or args.input.stat().st_size <= 0:
        parser.error("O arquivo 3D não existe ou está vazio.")
    if not (16 <= args.frame_width <= 512 and 16 <= args.frame_height <= 512):
        parser.error("O tamanho do frame deve estar entre 16 e 512 pixels por dimensão.")
    if not (2 <= args.turntable_frames <= 24):
        parser.error("turntable-frames precisa estar entre 2 e 24.")
    try:
        animations = json.loads(args.animations_json)
    except json.JSONDecodeError as error:
        parser.error(f"animations-json inválido: {error}")
    if not isinstance(animations, list) or any(not isinstance(item, str) for item in animations):
        parser.error("animations-json precisa ser uma lista de nomes.")
    args.animations = [item.strip() for item in animations if item.strip()]
    return args


def import_source(bpy, filepath: Path) -> None:
    suffix = filepath.suffix.lower()
    if suffix == ".blend":
        bpy.ops.wm.open_mainfile(filepath=str(filepath))
    elif suffix in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(filepath))
    elif suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(filepath))
    elif suffix == ".obj":
        if hasattr(bpy.ops.wm, "obj_import"):
            bpy.ops.wm.obj_import(filepath=str(filepath))
        else:
            bpy.ops.import_scene.obj(filepath=str(filepath))
    elif suffix == ".stl":
        if hasattr(bpy.ops.wm, "stl_import"):
            bpy.ops.wm.stl_import(filepath=str(filepath))
        else:
            bpy.ops.import_mesh.stl(filepath=str(filepath))
    else:
        raise RuntimeError(f"Formato 3D não suportado pelo adapter Blender: {suffix or '(sem extensão)'}")


def mesh_bounds(bpy):
    from mathutils import Vector

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.visible_get()]
    if not meshes:
        raise RuntimeError("O arquivo não contém objetos de malha visíveis para renderizar.")
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    dimensions = maximum - minimum
    if max(dimensions) <= 0:
        raise RuntimeError("A malha tem dimensões nulas; não é possível enquadrar o asset.")
    return meshes, (minimum + maximum) / 2, dimensions


def configure_render(bpy, args, center, dimensions):
    from mathutils import Vector

    scene = bpy.context.scene
    scene.render.resolution_x = args.frame_width
    scene.render.resolution_y = args.frame_height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = True
    scene.render.image_settings.compression = 15
    scene.render.filepath = "//"
    scene.render.use_file_extension = True
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys() else "BLENDER_EEVEE"
    scene.view_settings.view_transform = "Standard"
    scene.camera = None

    camera_data = bpy.data.cameras.new("LiaForge_Camera")
    camera = bpy.data.objects.new("LiaForge_Camera", camera_data)
    scene.collection.objects.link(camera)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(dimensions.x, dimensions.y, dimensions.z) * 1.35
    camera.data.lens = 50
    scene.camera = camera

    light_data = bpy.data.lights.new("LiaForge_Key", type="AREA")
    light = bpy.data.objects.new("LiaForge_Key", light_data)
    scene.collection.objects.link(light)
    light.data.energy = 1400
    light.data.shape = "DISK"
    light.data.size = max(dimensions.x, dimensions.y, dimensions.z) * 1.4
    light.location = center + Vector((dimensions.x * 1.1, -dimensions.y * 1.8, dimensions.z * 1.8))
    direction = center - light.location
    light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return scene, camera


def set_camera(camera, center, dimensions, angle_radians=0.0):
    from mathutils import Vector

    largest = max(dimensions.x, dimensions.y, dimensions.z)
    distance = max(largest * 3.0, 1.0)
    direction = Vector((math.sin(angle_radians), -math.cos(angle_radians), 0.08)).normalized()
    camera.location = center + direction * distance
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()


def matching_actions(bpy, requested):
    actions = list(bpy.data.actions)
    resolved = []
    missing = []
    for name in requested:
        exact = next((action for action in actions if action.name.casefold() == name.casefold()), None)
        candidate = exact or next((action for action in actions if name.casefold() in action.name.casefold()), None)
        if candidate is None:
            missing.append(name)
        else:
            resolved.append((name, candidate))
    if missing:
        raise RuntimeError("Não encontrei animação(ões) solicitada(s) no arquivo: " + ", ".join(missing))
    if requested and not any(obj.type == "ARMATURE" for obj in bpy.context.scene.objects):
        raise RuntimeError("Foram solicitadas animações, mas a cena não contém um rig/armature.")
    return resolved


def render_frames(bpy, args, scene, camera, center, dimensions, work_dir):
    frames_per_animation = args.turntable_frames if args.asset_type == "item" else 8
    rendered_rows = []
    if args.asset_type == "item":
        # A static prop gets a reproducible orthographic turntable. This is not
        # presented as an animation or as a generated 3D model.
        names = [("turntable", None)]
    else:
        actions = matching_actions(bpy, args.animations)
        if not actions:
            raise RuntimeError("Para renderizar o personagem, informe animações existentes no asset.")
        names = actions

    total = len(names) * frames_per_animation
    completed = 0
    armature = next((obj for obj in scene.objects if obj.type == "ARMATURE"), None)
    for row_index, (animation_name, action) in enumerate(names):
        if action is None:
            frame_indices = [None] * frames_per_animation
        else:
            armature.animation_data_create()
            armature.animation_data.action = action
            start, end = action.frame_range
            if end < start:
                raise RuntimeError(f"Intervalo de frames inválido para {animation_name}.")
            if math.isclose(start, end):
                frame_indices = [int(round(start))] * frames_per_animation
            else:
                frame_indices = [int(round(start + (end - start) * index / (frames_per_animation - 1))) for index in range(frames_per_animation)]

        row_paths = []
        for column_index, frame_index in enumerate(frame_indices):
            if args.asset_type == "item":
                angle = (2 * math.pi * column_index) / frames_per_animation
                set_camera(camera, center, dimensions, angle)
            elif frame_index is not None:
                scene.frame_set(frame_index)
                set_camera(camera, center, dimensions, 0.0)

            filename = f"row-{row_index:03d}-frame-{column_index:03d}.png"
            scene.render.filepath = str(work_dir / filename)
            bpy.ops.render.render(write_still=True)
            rendered = work_dir / filename
            if not rendered.is_file() or rendered.stat().st_size <= 32:
                raise RuntimeError(f"O Blender não gerou o frame esperado: {filename}")
            row_paths.append({"path": rendered, "sourceFrame": frame_index, "column": column_index})
            completed += 1
            report(f"Renderizando {animation_name} · frame {column_index + 1}/{frames_per_animation}", 10 + completed * 75 // total)
        rendered_rows.append({"name": animation_name, "frames": row_paths})
    return rendered_rows, frames_per_animation


def pack_atlas(bpy, args, rows, frames_per_row, output_dir):
    sheet_width = args.frame_width * frames_per_row
    sheet_height = args.frame_height * len(rows)
    atlas = array.array("f", [0.0]) * (sheet_width * sheet_height * 4)
    frame_metadata = []
    for row_index, row in enumerate(rows):
        for frame in row["frames"]:
            image = bpy.data.images.load(str(frame["path"]), check_existing=False)
            if int(image.size[0]) != args.frame_width or int(image.size[1]) != args.frame_height:
                bpy.data.images.remove(image)
                raise RuntimeError("Um frame renderizado tem dimensão diferente do tamanho solicitado.")
            pixels = array.array("f", [0.0]) * (args.frame_width * args.frame_height * 4)
            image.pixels.foreach_get(pixels)
            target_x = frame["column"] * args.frame_width
            # PNG metadata uses a top-left origin; Blender's pixel buffer uses bottom-left.
            target_row_from_bottom = len(rows) - row_index - 1
            target_y = target_row_from_bottom * args.frame_height
            for y in range(args.frame_height):
                source_start = y * args.frame_width * 4
                target_start = (target_y + y) * sheet_width * 4 + target_x * 4
                atlas[target_start : target_start + args.frame_width * 4] = pixels[source_start : source_start + args.frame_width * 4]
            pivot_y = args.frame_height - 1 if args.asset_type == "character" else args.frame_height // 2
            frame_metadata.append({
                "filename": f"{args.asset_name}_{row['name']}_{frame['column']:02d}",
                "animation": row["name"],
                "frame": frame["column"],
                "sourceFrame": frame["sourceFrame"],
                "x": target_x,
                "y": row_index * args.frame_height,
                "width": args.frame_width,
                "height": args.frame_height,
                "pivot": {"x": args.frame_width // 2, "y": pivot_y},
                "durationMs": 100,
            })
            bpy.data.images.remove(image)

    output_dir.mkdir(parents=True, exist_ok=True)
    image = bpy.data.images.new("LiaForge_Spritesheet", width=sheet_width, height=sheet_height, alpha=True, float_buffer=False)
    image.pixels.foreach_set(atlas)
    image.filepath_raw = str(output_dir / "spritesheet.png")
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)

    slug = re.sub(r"[^a-z0-9]+", "-", args.asset_name.casefold()).strip("-") or "asset"
    metadata = {
        "schemaVersion": 1,
        "generator": "Lia Forge Blender adapter",
        "asset": args.asset_name,
        "assetType": args.asset_type,
        "sourceFile": args.input.name,
        "frameWidth": args.frame_width,
        "frameHeight": args.frame_height,
        "columns": frames_per_row,
        "rows": len(rows),
        "sheetWidth": sheet_width,
        "sheetHeight": sheet_height,
        "origin": "top-left",
        "anchor": "feet" if args.asset_type == "character" else "center",
        "animations": [row["name"] for row in rows],
        "frames": frame_metadata,
    }
    metadata_path = output_dir / "spritesheet.json"
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return output_dir / "spritesheet.png", metadata_path


def main(argv=None):
    args = parse_args(list(sys.argv if argv is None else argv))
    import bpy  # Blender's bundled Python module; intentionally not a project dependency.

    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    work_dir = Path(tempfile.mkdtemp(prefix="lia-forge-frames-", dir=str(output_dir)))
    try:
        report("Carregando modelo 3D", 2)
        import_source(bpy, args.input.resolve())
        scene = bpy.context.scene
        meshes, center, dimensions = mesh_bounds(bpy)
        scene, camera = configure_render(bpy, args, center, dimensions)
        report("Preparando câmera ortográfica e transparência", 8)
        rows, frames_per_row = render_frames(bpy, args, scene, camera, center, dimensions, work_dir)
        png_path, json_path = pack_atlas(bpy, args, rows, frames_per_row, output_dir)
        report("Atlas e metadados escritos; aguardando validação estrutural", 90)
        print(json.dumps({"png": str(png_path), "metadata": str(json_path)}, ensure_ascii=False), flush=True)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
