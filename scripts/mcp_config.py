"""Install project-scoped Lia Forge MCP entries for supported agent clients."""
from __future__ import annotations

import json
import os
import re
import uuid
from pathlib import Path
from typing import Any

try:
    from .spriteforge_launcher import BootstrapError, ROOT, find_executable
except ImportError:  # Direct execution from the launcher's scripts directory.
    from spriteforge_launcher import BootstrapError, ROOT, find_executable

SERVER_FILE = ROOT / "scripts" / "spriteforge-mcp.mjs"


def _toml_string(value: str) -> str:
    # JSON string escaping is compatible with TOML basic strings for these paths.
    return json.dumps(value, ensure_ascii=False)


def _ensure_project_scoped(file_path: Path, project_root: Path) -> None:
    root = project_root.resolve()
    if file_path.is_symlink():
        raise BootstrapError(f"{file_path} é um link simbólico; não alterei o arquivo.")
    parent = file_path.parent
    while parent != root:
        if parent.exists():
            try:
                parent.resolve().relative_to(root)
            except ValueError as exc:
                raise BootstrapError(f"{file_path} aponta para fora do workspace por um link simbólico.") from exc
        next_parent = parent.parent
        if next_parent == parent:
            raise BootstrapError(f"{file_path} não está dentro do workspace {root}.")
        parent = next_parent


def _atomic_text_write(file_path: Path, content: str, project_root: Path) -> None:
    _ensure_project_scoped(file_path, project_root)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = file_path.with_name(f"{file_path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
    try:
        temporary.write_text(content, encoding="utf-8")
        os.replace(temporary, file_path)
    finally:
        temporary.unlink(missing_ok=True)


def _merge_json_config(file_path: Path, container_key: str, entry: dict[str, Any], project_root: Path) -> tuple[bool, Path]:
    _ensure_project_scoped(file_path, project_root)
    if file_path.exists():
        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise BootstrapError(f"JSON inválido em {file_path}: {exc}; não alterei o arquivo.") from exc
        if not isinstance(data, dict):
            raise BootstrapError(f"A raiz de {file_path} precisa ser um objeto JSON; não alterei o arquivo.")
    else:
        data = {}

    entries = data.setdefault(container_key, {})
    if not isinstance(entries, dict):
        raise BootstrapError(f"A propriedade {container_key!r} em {file_path} precisa ser um objeto JSON.")
    existing = entries.get("spriteforge")
    if existing is not None:
        if existing == entry:
            return False, file_path
        raise BootstrapError(
            f"Já existe uma entrada 'spriteforge' em {file_path}. Não sobrescrevi a configuração; "
            "revise/mescle-a manualmente antes de tentar novamente."
        )
    entries["spriteforge"] = entry
    _atomic_text_write(file_path, json.dumps(data, ensure_ascii=False, indent=2) + "\n", project_root)
    return True, file_path


def install_mcp_config(client: str, project_root: Path) -> tuple[bool, Path]:
    if client not in {"claude", "codex", "opencode"}:
        raise BootstrapError("Cliente MCP inválido; use claude, codex ou opencode.")
    project_root = project_root.expanduser().resolve()
    project_root.mkdir(parents=True, exist_ok=True)
    node = find_executable("node")
    if not node:
        raise BootstrapError("Node.js não foi encontrado. Rode ./lia-forge setup primeiro.")
    server_file = SERVER_FILE.resolve()
    environment = {
        "SPRITEFORGE_HOME": str(ROOT.resolve()),
        "SPRITEFORGE_PROJECT_ROOT": str(project_root),
    }

    if client == "claude":
        entry = {"command": node, "args": [str(server_file)], "env": environment}
        return _merge_json_config(project_root / ".mcp.json", "mcpServers", entry, project_root)

    if client == "opencode":
        entry = {
            "type": "local",
            "command": [node, str(server_file)],
            "enabled": True,
            "environment": environment,
        }
        return _merge_json_config(project_root / "opencode.json", "mcp", entry, project_root)

    config_file = project_root / ".codex" / "config.toml"
    _ensure_project_scoped(config_file, project_root)
    try:
        existing_text = config_file.read_text(encoding="utf-8") if config_file.exists() else ""
    except OSError as exc:
        raise BootstrapError(f"Não consegui ler {config_file}: {exc}") from exc
    section_pattern = re.compile(r"(?m)^\s*\[mcp_servers\.spriteforge(?:\.[^\]]+)?\]\s*(?:#.*)?$")
    if section_pattern.search(existing_text):
        block = "\n".join([
            "[mcp_servers.spriteforge]",
            f"command = {_toml_string(node)}",
            f"args = [{_toml_string(str(server_file))}]",
            f"cwd = {_toml_string(str(project_root))}",
            "env = { SPRITEFORGE_HOME = " + _toml_string(environment["SPRITEFORGE_HOME"])
            + ", SPRITEFORGE_PROJECT_ROOT = " + _toml_string(environment["SPRITEFORGE_PROJECT_ROOT"]) + " }",
            "startup_timeout_sec = 30",
            "tool_timeout_sec = 600",
            "enabled = true",
        ])
        if block in existing_text:
            return False, config_file
        raise BootstrapError(
            f"Já existe uma tabela [mcp_servers.spriteforge] em {config_file}. "
            "Não sobrescrevi o TOML; revise/mescle-a manualmente."
        )

    block = "\n".join([
        "[mcp_servers.spriteforge]",
        f"command = {_toml_string(node)}",
        f"args = [{_toml_string(str(server_file))}]",
        f"cwd = {_toml_string(str(project_root))}",
        "env = { SPRITEFORGE_HOME = " + _toml_string(environment["SPRITEFORGE_HOME"])
        + ", SPRITEFORGE_PROJECT_ROOT = " + _toml_string(environment["SPRITEFORGE_PROJECT_ROOT"]) + " }",
        "startup_timeout_sec = 30",
        "tool_timeout_sec = 600",
        "enabled = true",
    ])
    separator = "\n\n" if existing_text.strip() else ""
    _atomic_text_write(config_file, f"{existing_text.rstrip()}{separator}{block}\n", project_root)
    return True, config_file
