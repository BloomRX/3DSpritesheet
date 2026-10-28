import hashlib
import json
import os
import tempfile
import time
import unittest
from unittest.mock import patch
from pathlib import Path

from scripts.lia_paths import resolve_lia_paths
from scripts.spriteforge_launcher import (
    BootstrapError,
    accepted_license,
    acquire_model_download_lock,
    build_parser,
    comfyui_server_status,
    ensure_recommended_apps,
    has_model_license_acceptance,
    license_acceptance_file,
    model_slug,
    model_target_path,
    record_model_license_acceptance,
    release_model_download_lock,
    node_version_meets_minimum,
    normalized_command,
    package_dependencies_ready,
    sha256_file,
    tool_status,
)


class BootstrapHelpersTest(unittest.TestCase):
    def test_model_id_is_safe_for_a_directory_name(self):
        self.assertEqual(model_slug("my image/model v1"), "my-image-model-v1")
        self.assertEqual(model_slug("../../weights"), "weights")

    def test_node_version_checks_full_electron_minimum(self):
        self.assertTrue(node_version_meets_minimum("v22.12.0"))
        self.assertTrue(node_version_meets_minimum("v24.0.0"))
        self.assertFalse(node_version_meets_minimum("v22.11.9"))
        self.assertFalse(node_version_meets_minimum("v20.19.0"))
        self.assertFalse(node_version_meets_minimum("unknown"))

    def test_python_path_resolver_uses_brand_roots_without_creating_them(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory) / "profile"
            local = Path(directory) / "local"
            roaming = Path(directory) / "roaming"
            resolved = resolve_lia_paths(
                env={"LOCALAPPDATA": str(local), "APPDATA": str(roaming)},
                home_directory=home,
                documents_directory=Path(directory) / "Documents",
                system="Windows",
                is_packaged=True,
                cwd=Path(directory) / "source",
            )
            self.assertEqual(resolved["workspaceRoot"], home / "Lia" / "Forge")
            self.assertEqual(resolved["legacyWorkspaceRoot"], Path(directory) / "Documents" / "Lia Forge")
            self.assertEqual(resolved["modelDirectory"], local / "Lia" / "Modelos")
            self.assertEqual(resolved["configDirectory"], roaming / "Lia" / "Forge" / "config")
            self.assertFalse(local.exists())
            self.assertFalse(roaming.exists())

    def test_model_target_stays_inside_shared_user_directory(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict("os.environ", {"LIA_MODELOS": directory}):
            target = model_target_path({"id": "depth-model", "filename": "weights.safetensors"})
            self.assertEqual(target.name, "weights.safetensors")
            self.assertEqual(target.parent.name, "depth-model")
            self.assertEqual(target.parent.parent, Path(directory).resolve())

    def test_model_filename_cannot_escape_shared_directory(self):
        with self.assertRaises(BootstrapError):
            model_target_path({"id": "depth-model", "filename": "../outside.bin"})

    def test_model_download_lock_serializes_shared_downloads(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "models" / "selected-model" / "weights.bin"
            partial = target.with_name(target.name + ".download")
            lock_file = acquire_model_download_lock(target, partial)
            self.assertTrue(lock_file.is_file())
            with self.assertRaisesRegex(BootstrapError, "Outro processo"):
                acquire_model_download_lock(target, partial)
            release_model_download_lock(lock_file)
            self.assertFalse(lock_file.exists())

    def test_model_download_lock_reclaims_only_after_stale_timeout(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "models" / "selected-model" / "weights.bin"
            partial = target.with_name(target.name + ".download")
            lock_file = target.with_name(target.name + ".lock")
            lock_file.parent.mkdir(parents=True)
            lock_file.write_text("stale", encoding="utf-8")
            partial.write_bytes(b"stale")
            stale_time = time.time() - 60 * 60 - 1
            os.utime(lock_file, (stale_time, stale_time))
            os.utime(partial, (stale_time, stale_time))
            acquired = acquire_model_download_lock(target, partial)
            self.assertEqual(acquired, lock_file)
            self.assertFalse(partial.exists())
            release_model_download_lock(acquired)

    def test_sha256_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "weights.bin"
            path.write_bytes(b"spriteforge-test")
            self.assertEqual(sha256_file(path), hashlib.sha256(b"spriteforge-test").hexdigest())

    def test_license_acceptance_uses_brand_config_directory(self):
        with tempfile.TemporaryDirectory() as directory, patch("scripts.spriteforge_launcher.resolve_lia_paths", return_value={"configDirectory": Path(directory)}):
            self.assertEqual(license_acceptance_file(), Path(directory) / "model-license-acceptances.json")

    def test_model_license_consent_is_saved_outside_the_repository_and_bound_to_version(self):
        with tempfile.TemporaryDirectory() as directory:
            consent_file = Path(directory) / "AppData" / "Roaming" / "Lia" / "Forge" / "config" / "model-license-acceptances.json"
            model = {
                "id": "selected-model",
                "licenseUrl": "https://example.test/license",
                "sha256": "a" * 64,
            }
            self.assertFalse(has_model_license_acceptance(model, acceptance_file=consent_file))
            record_model_license_acceptance(model, acceptance_file=consent_file)
            self.assertTrue(has_model_license_acceptance(model, acceptance_file=consent_file))
            self.assertFalse(has_model_license_acceptance({**model, "sha256": "b" * 64}, acceptance_file=consent_file))
            stored = json.loads(consent_file.read_text(encoding="utf-8"))
            self.assertEqual(stored["schemaVersion"], 1)
            self.assertEqual(stored["accepted"][0]["licenseUrl"], model["licenseUrl"])
            self.assertNotIn("licenseAccepted", model)

    def test_yes_flag_never_accepts_model_license_automatically(self):
        model = {"id": "selected-model", "licenseUrl": "https://example.test/license", "sha256": "a" * 64}
        with patch("scripts.spriteforge_launcher.has_model_license_acceptance", return_value=False), patch(
            "scripts.spriteforge_launcher.record_model_license_acceptance"
        ) as record:
            self.assertFalse(accepted_license(model, yes=True))
        record.assert_not_called()

    def test_installed_npm_tree_matches_lockfile(self):
        self.assertTrue(package_dependencies_ready())

    def test_desktop_window_is_the_default_launcher_mode(self):
        args = build_parser().parse_args([])
        self.assertFalse(args.web)
        self.assertFalse(args.no_browser)

    def test_diagnostico_alias_is_available(self):
        args = build_parser().parse_args(["diagnostico", "--json"])
        self.assertEqual(args.command, "diagnostico")
        self.assertTrue(args.json)

    def test_comfyui_probe_reports_unavailable_without_installing(self):
        with patch.dict("os.environ", {"COMFYUI_URL": "http://127.0.0.1:1"}):
            status = comfyui_server_status()
        self.assertFalse(status["running"])
        self.assertEqual(status["endpoint"], "http://127.0.0.1:1")

    def test_windows_batch_command_quotes_program_files_path_for_cmd(self):
        with patch("scripts.spriteforge_launcher.os.name", "nt"), patch("scripts.spriteforge_launcher.Path") as path_type, patch.dict(
            "os.environ", {"COMSPEC": r"C:\Windows\System32\cmd.exe"}
        ):
            path_type.return_value.suffix = ".CMD"
            command = normalized_command([r"C:\Program Files\nodejs\npm.CMD", "ci"])
        self.assertEqual(
            command,
            r'"C:\Windows\System32\cmd.exe" /d /s /c ""C:\Program Files\nodejs\npm.CMD" ci"',
        )

    def test_failed_npm_probe_is_not_reported_as_installed(self):
        with patch("scripts.spriteforge_launcher.find_executable", return_value=r"C:\Program Files\nodejs\npm.CMD"), patch(
            "scripts.spriteforge_launcher.read_version", return_value=("npm command failed", None)
        ):
            status = tool_status("npm")
        self.assertFalse(status["installed"])
        self.assertEqual(status["path"], r"C:\Program Files\nodejs\npm.CMD")

    def test_blender_installed_in_external_steam_library_is_detected(self):
        with tempfile.TemporaryDirectory() as directory:
            temp_root = Path(directory)
            steam_root = temp_root / "Steam"
            library = temp_root / "SteamLibrary"
            (steam_root / "steamapps").mkdir(parents=True)
            vdf = (
                '"libraryfolders"\n{\n'
                f'  "0"\n  {{\n    "path" "{steam_root}"\n  }}\n'
                f'  "1"\n  {{\n    "path" "{library}"\n  }}\n'
                '}\n'
            )
            (steam_root / "steamapps" / "libraryfolders.vdf").write_text(vdf, encoding="utf-8")
            blender = library / "steamapps" / "common" / "Blender" / "blender.exe"
            blender.parent.mkdir(parents=True)
            blender.write_bytes(b"test executable")

            with patch("scripts.spriteforge_launcher.platform.system", return_value="Windows"), patch(
                "scripts.spriteforge_launcher.steam_install_roots", return_value=[steam_root]
            ), patch("scripts.spriteforge_launcher.shutil.which", return_value=None), patch(
                "scripts.spriteforge_launcher.read_version", return_value=("Blender 4.5.0", 4)
            ), patch.dict("os.environ", {"ProgramFiles": str(temp_root / "Program Files")}):
                status = tool_status("blender")

        self.assertTrue(status["installed"])
        self.assertEqual(status["path"], str(blender))
        self.assertEqual(status["version"], "Blender 4.5.0")

    def test_recommended_apps_prompt_excludes_apps_already_installed(self):
        def status_for(name):
            return {"installed": name == "blender"}

        with patch("scripts.spriteforge_launcher.tool_status", side_effect=status_for), patch(
            "scripts.spriteforge_launcher.ask_yes_no", return_value=False
        ) as ask:
            missing = ensure_recommended_apps(
                {"bootstrap": {"recommendedApps": ["blender", "krita"]}},
                yes=False,
                no_tools=False,
                dry_run=False,
            )

        self.assertEqual(missing, ["krita"])
        self.assertEqual(ask.call_args[0][0], "Instalar agora: Krita?")

    def test_windows_doctor_without_python_exits_before_install_logic(self):
        launcher = (Path(__file__).resolve().parents[1] / "spriteforge.cmd").read_text(encoding="utf-8")
        self.assertIn('if /I "%~1"=="doctor" (', launcher)
        doctor_block = launcher.split('if /I "%~1"=="doctor" (', 1)[1].split("  )", 1)[0]
        self.assertIn("exit /b 1", doctor_block)
        self.assertNotIn("winget install", doctor_block)
        self.assertNotIn("(winget)", launcher)


if __name__ == "__main__":
    unittest.main()
