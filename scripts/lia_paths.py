"""Portable, user-owned Lia data paths used by the developer bootstrapper."""
from __future__ import annotations

import os
import platform as platform_module
from pathlib import Path
from typing import Mapping


def _configured_path(value: str | None, home: Path) -> Path | None:
    if not value or not value.strip():
        return None
    expanded = Path(value.strip()).expanduser()
    if not expanded.is_absolute():
        expanded = Path.cwd() / expanded
    return expanded.resolve()


def resolve_lia_paths(
    *,
    env: Mapping[str, str] | None = None,
    home_directory: Path | str | None = None,
    documents_directory: Path | str | None = None,
    system: str | None = None,
    is_packaged: bool = False,
    cwd: Path | str | None = None,
) -> dict[str, Path | str | None]:
    """Resolve brand roots without creating directories or moving user data."""
    values = os.environ if env is None else env
    home = Path(home_directory or Path.home()).expanduser().resolve()
    current = Path(cwd or Path.cwd()).expanduser().resolve()
    configured_lia_home = _configured_path(values.get("LIA_HOME"), home)
    lia_home = configured_lia_home or (home / "Lia")
    explicit_workspace = _configured_path(values.get("SPRITEFORGE_PROJECT_ROOT"), home)

    if explicit_workspace:
        workspace_root = explicit_workspace
        workspace_source = "SPRITEFORGE_PROJECT_ROOT"
    elif configured_lia_home:
        workspace_root = lia_home / "Forge"
        workspace_source = "LIA_HOME"
    elif is_packaged:
        workspace_root = lia_home / "Forge"
        workspace_source = "padrão Lia"
    else:
        workspace_root = current
        workspace_source = "diretório atual (desenvolvimento)"

    windows = (system or platform_module.system()).lower() in {"windows", "win32", "nt"}
    if windows:
        roaming_base = _configured_path(values.get("APPDATA"), home) or home / "AppData" / "Roaming"
        local_base = _configured_path(values.get("LOCALAPPDATA"), home) or home / "AppData" / "Local"
        model_base = local_base
    else:
        roaming_base = _configured_path(values.get("XDG_CONFIG_HOME"), home) or home / ".config"
        local_base = _configured_path(values.get("XDG_CACHE_HOME"), home) or home / ".cache"
        model_base = _configured_path(values.get("XDG_DATA_HOME"), home) or home / ".local" / "share"

    data_directory = _configured_path(values.get("LIA_DATA"), home) or local_base / "Lia" / "Forge"
    model_directory = _configured_path(values.get("LIA_MODELOS"), home) or model_base / "Lia" / "Modelos"
    config_directory = roaming_base / "Lia" / "Forge" / "config"

    legacy_workspace = None
    if is_packaged and not explicit_workspace and not configured_lia_home:
        documents = Path(documents_directory).expanduser().resolve() if documents_directory else home / "Documents"
        legacy_workspace = documents / "Lia Forge"

    return {
        "homeDirectory": home,
        "liaHome": lia_home,
        "workspaceRoot": workspace_root.resolve(),
        "workspaceRootSource": workspace_source,
        "legacyWorkspaceRoot": legacy_workspace,
        "configDirectory": config_directory,
        "dataDirectory": data_directory,
        "cacheDirectory": data_directory / "cache",
        "logsDirectory": data_directory / "logs",
        "modelDirectory": model_directory,
    }


def model_directory(env: Mapping[str, str] | None = None) -> Path:
    """Return the shared, user-owned model directory; never create or download into it."""
    return Path(resolve_lia_paths(env=env)["modelDirectory"])
