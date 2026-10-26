"""Local-first Lia Forge bootstrapper. Standard library only."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "spriteforge.config.json"
MODEL_ROOT = ROOT / ".spriteforge" / "models"
MIN_NODE_VERSION = (22, 12, 0)
MIN_NODE_VERSION_TEXT = ".".join(str(part) for part in MIN_NODE_VERSION)
TOOL_LABELS = {
    "python": "Python runtime",
    "node": "Node.js",
    "npm": "npm",
    "electron": "Electron desktop runtime",
    "blender": "Blender",
    "krita": "Krita",
    "claude": "Claude Code CLI",
    "codex": "Codex CLI",
    "opencode": "OpenCode CLI",
    "ollama": "Ollama local runtime",
    "comfy": "Comfy CLI",
    "comfy-mcp": "Comfy MCP oficial",
    "comfyui": "ComfyUI local API",
}
APP_INFO: dict[str, dict[str, str]] = {
    "blender": {
        "label": "Blender",
        "purpose": "modelo 3D, rigging e render de sprites",
        "winget": "BlenderFoundation.Blender",
        "brew": "blender",
    },
    "krita": {
        "label": "Krita",
        "purpose": "edição de conceitos e folhas de referência",
        "winget": "KDE.Krita",
        "brew": "krita",
    },
    "opencode": {
        "label": "OpenCode",
        "purpose": "agente de código local/alternativo",
    },
    "ollama": {
        "label": "Ollama",
        "purpose": "runtime local para modelos open-weight",
        "winget": "Ollama.Ollama",
        "brew": "ollama",
    },
}


class BootstrapError(RuntimeError):
    pass


def print_step(text: str) -> None:
    print(f"\n{'─' * 2} {text}")


def load_config() -> dict[str, Any]:
    try:
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise BootstrapError(f"Arquivo de configuração ausente: {CONFIG_PATH}") from exc
    except json.JSONDecodeError as exc:
        raise BootstrapError(f"JSON inválido em {CONFIG_PATH}: {exc}") from exc
    if not isinstance(config, dict) or config.get("version") != 1:
        raise BootstrapError("spriteforge.config.json precisa ter version: 1.")
    bootstrap = config.get("bootstrap", {})
    if not isinstance(bootstrap, dict):
        raise BootstrapError("A propriedade 'bootstrap' precisa ser um objeto JSON.")
    apps = bootstrap.get("recommendedApps", ["blender", "krita"])
    if not isinstance(apps, list) or any(not isinstance(app, str) for app in apps):
        raise BootstrapError("bootstrap.recommendedApps precisa ser uma lista de nomes de apps.")
    models = config.get("models", [])
    if not isinstance(models, list):
        raise BootstrapError("A propriedade 'models' precisa ser uma lista.")
    for index, model in enumerate(models):
        if not isinstance(model, dict):
            raise BootstrapError(f"models[{index}] precisa ser um objeto JSON.")
        if not isinstance(model.get("id"), str) or not model["id"].strip():
            raise BootstrapError(f"models[{index}] precisa ter um id não vazio.")
    return config


def save_config(config: dict[str, Any]) -> None:
    CONFIG_PATH.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalized_command(command: list[str]) -> list[str] | str:
    """Run Windows batch entry points through cmd.exe with one correctly quoted command line."""
    if os.name == "nt" and command and Path(command[0]).suffix.lower() in {".cmd", ".bat"}:
        comspec = os.environ.get("COMSPEC", "cmd.exe")
        batch_command = subprocess.list2cmdline(command)
        # /s strips the first and last quote after /c. The extra pair keeps
        # a quoted executable path intact when its installation directory has spaces.
        return f'"{comspec}" /d /s /c "{batch_command}"'
    return command


def command_text(command: list[str]) -> str:
    return subprocess.list2cmdline(command) if os.name == "nt" else " ".join(command)


def run_command(command: list[str], *, cwd: Path | None = None, capture: bool = False, check: bool = False) -> subprocess.CompletedProcess[str]:
    actual = normalized_command(command)
    if capture:
        result = subprocess.run(actual, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
    else:
        result = subprocess.run(actual, cwd=cwd, text=True, check=False)
    if check and result.returncode != 0:
        output = (result.stdout or "").strip()
        detail = f"\n{output}" if output else ""
        raise BootstrapError(f"Comando falhou ({result.returncode}): {command_text(command)}{detail}")
    return result


def steam_install_roots() -> list[Path]:
    """Locate Steam roots from environment, common install paths, and Windows registry."""
    if platform.system() != "Windows":
        return []

    roots: list[Path] = []
    for variable in ("STEAM_DIR", "STEAM_PATH", "STEAMROOT", "SteamPath"):
        value = os.environ.get(variable)
        if value:
            roots.append(Path(value))
    for variable in ("ProgramFiles(x86)", "ProgramFiles"):
        value = os.environ.get(variable)
        if value:
            roots.append(Path(value) / "Steam")

    try:
        import winreg
    except ImportError:
        winreg = None
    if winreg is not None:
        registry_locations = (
            (winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam", "SteamPath"),
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Valve\Steam", "InstallPath"),
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam", "InstallPath"),
        )
        for hive, key_name, value_name in registry_locations:
            try:
                with winreg.OpenKey(hive, key_name) as key:
                    value, _ = winreg.QueryValueEx(key, value_name)
                if value:
                    roots.append(Path(str(value)))
            except OSError:
                continue

    unique: list[Path] = []
    seen: set[str] = set()
    for root in roots:
        key = os.path.normpath(str(root)).casefold()
        if key not in seen:
            seen.add(key)
            unique.append(root)
    return unique


def steam_library_paths() -> list[Path]:
    """Return the Steam install root and library folders from libraryfolders.vdf."""
    libraries: list[Path] = []
    for root in steam_install_roots():
        libraries.append(root)
        manifest = root / "steamapps" / "libraryfolders.vdf"
        try:
            content = manifest.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for match in re.finditer(r'(?m)^\s*"path"\s*"((?:\\.|[^"])*)"\s*$', content):
            value = match.group(1).replace(r"\\", "\\").replace(r'\"', '"')
            if value:
                libraries.append(Path(value))

    unique: list[Path] = []
    seen: set[str] = set()
    for library in libraries:
        key = os.path.normpath(str(library)).casefold()
        if key not in seen:
            seen.add(key)
            unique.append(library)
    return unique


def app_candidates(name: str) -> list[Path]:
    system = platform.system()
    candidates: list[Path] = []
    if name == "node":
        if system == "Windows":
            candidates += [Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "nodejs" / "node.exe"]
            candidates += [Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "nodejs" / "node.exe"]
        elif system == "Darwin":
            candidates += [Path("/opt/homebrew/bin/node"), Path("/usr/local/bin/node"), Path("/usr/bin/node")]
        else:
            candidates += [Path("/usr/bin/node"), Path("/usr/local/bin/node"), Path("/snap/bin/node")]
    elif name == "npm":
        if system == "Windows":
            candidates += [Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "nodejs" / "npm.cmd"]
            candidates += [Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "nodejs" / "npm.exe"]
        elif system == "Darwin":
            candidates += [Path("/opt/homebrew/bin/npm"), Path("/usr/local/bin/npm"), Path("/usr/bin/npm")]
        else:
            candidates += [Path("/usr/bin/npm"), Path("/usr/local/bin/npm")]
    elif name == "opencode":
        if system == "Windows":
            candidates += [Path(os.environ.get("APPDATA", str(Path.home() / "AppData" / "Roaming"))) / "npm" / "opencode.cmd"]
            candidates += [Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))) / "Programs" / "opencode" / "opencode.exe"]
        elif system == "Darwin":
            candidates += [Path("/opt/homebrew/bin/opencode"), Path("/usr/local/bin/opencode"), Path.home() / ".opencode" / "bin" / "opencode"]
        else:
            candidates += [Path("/usr/local/bin/opencode"), Path("/usr/bin/opencode"), Path.home() / ".opencode" / "bin" / "opencode", Path.home() / ".local" / "bin" / "opencode"]
    elif name == "ollama":
        if system == "Windows":
            candidates += [Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))) / "Programs" / "Ollama" / "ollama.exe"]
            candidates += [Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Ollama" / "ollama.exe"]
        elif system == "Darwin":
            candidates += [Path("/Applications/Ollama.app/Contents/Resources/ollama"), Path("/opt/homebrew/bin/ollama"), Path("/usr/local/bin/ollama")]
        else:
            candidates += [Path("/usr/local/bin/ollama"), Path("/usr/bin/ollama"), Path("/snap/bin/ollama")]
    elif name == "blender":
        if system == "Windows":
            base = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Blender Foundation"
            candidates += sorted(base.glob("Blender*/blender.exe"), reverse=True)
            for library in steam_library_paths():
                common = library / "steamapps" / "common"
                candidates += [common / "Blender" / "blender.exe"]
                candidates += sorted(common.glob("Blender*/blender.exe"), reverse=True)
        elif system == "Darwin":
            candidates += [Path("/Applications/Blender.app/Contents/MacOS/Blender"), Path("/opt/homebrew/bin/blender"), Path("/usr/local/bin/blender")]
        else:
            candidates += [Path("/usr/bin/blender"), Path("/snap/bin/blender"), Path("/var/lib/flatpak/exports/bin/org.blender.Blender")]
    elif name == "krita":
        if system == "Windows":
            base = Path(os.environ.get("ProgramFiles", r"C:\Program Files"))
            candidates += [base / "Krita (x64)" / "bin" / "krita.exe", base / "Krita" / "bin" / "krita.exe"]
        elif system == "Darwin":
            candidates += [Path("/Applications/krita.app/Contents/MacOS/krita"), Path("/Applications/Krita.app/Contents/MacOS/krita"), Path("/opt/homebrew/bin/krita"), Path("/usr/local/bin/krita")]
        else:
            candidates += [Path("/usr/bin/krita"), Path("/snap/bin/krita"), Path("/var/lib/flatpak/exports/bin/org.kde.krita")]
    return candidates


def find_executable(name: str) -> str | None:
    found = shutil.which(name)
    if found:
        return found
    for candidate in app_candidates(name):
        if candidate.is_file():
            return str(candidate)
    return None


def read_version(executable: str, args: list[str], pattern: str) -> tuple[str, int | None]:
    try:
        result = run_command([executable, *args], capture=True)
        text = (result.stdout or "").strip().splitlines()[0] if result.stdout else ""
        if result.returncode != 0:
            return text or "comando falhou", None
        match = re.search(pattern, text)
        return text or "versão desconhecida", int(match.group(1)) if match else None
    except (OSError, IndexError):
        return "versão desconhecida", None


def tool_status(name: str) -> dict[str, Any]:
    executable = find_executable(name)
    if not executable:
        return {"name": name, "installed": False, "path": None, "version": None, "major": None}
    if name == "node":
        version, major = read_version(executable, ["--version"], r"v?(\d+)")
    elif name == "npm":
        version, major = read_version(executable, ["--version"], r"(\d+)")
    elif name == "blender":
        version, major = read_version(executable, ["--version"], r"Blender\s+(\d+)")
    elif name == "krita":
        version, major = read_version(executable, ["--version"], r"(\d+)")
    elif name in {"opencode", "ollama", "comfy"}:
        version, major = read_version(executable, ["--version"], r"(\d+)")
    elif name == "comfy-mcp":
        version, major = "installed", None
    else:
        version, major = "installed", None
    versioned_tools = {"node", "npm", "blender", "krita", "opencode", "ollama", "comfy"}
    if name in versioned_tools and major is None:
        return {"name": name, "installed": False, "path": executable, "version": version, "major": None}
    return {"name": name, "installed": True, "path": executable, "version": version, "major": major}


def node_version_meets_minimum(version: str | None) -> bool:
    if not version:
        return False
    match = re.search(r"v?(\d+)\.(\d+)(?:\.(\d+))?", version)
    if not match:
        return False
    current = tuple(int(part or 0) for part in match.groups())
    return current >= MIN_NODE_VERSION


def get_package_manager() -> tuple[str | None, str | None]:
    system = platform.system()
    if system == "Windows":
        return ("winget", shutil.which("winget"))
    if system == "Darwin":
        return ("brew", shutil.which("brew"))
    for name in ("apt-get", "dnf", "pacman"):
        path = shutil.which(name)
        if path:
            return (name, path)
    return (None, None)


def package_command(tool: str, *, upgrade: bool = False) -> list[str]:
    system = platform.system()
    manager, manager_path = get_package_manager()
    if not manager or not manager_path:
        raise BootstrapError(
            "Não encontrei um gerenciador de pacotes compatível. Instale a ferramenta manualmente "
            "e rode ./lia-forge novamente."
        )
    if system == "Windows":
        package_id = APP_INFO[tool]["winget"] if tool in APP_INFO else "OpenJS.NodeJS.LTS"
        verb = "upgrade" if upgrade else "install"
        return [manager_path, verb, "--id", package_id, "--exact", "--silent", "--accept-package-agreements", "--accept-source-agreements"]
    if system == "Darwin":
        if tool == "node":
            return [manager_path, "upgrade" if upgrade else "install", "node"]
        package = APP_INFO[tool]["brew"]
        return [manager_path, "install", "--cask", package]
    packages: list[str]
    if tool == "node":
        packages = ["nodejs", "npm"] if manager == "apt-get" else ["nodejs", "npm"]
    else:
        packages = [tool]
    if manager == "apt-get":
        prefix = [] if hasattr(os, "geteuid") and os.geteuid() == 0 else ["sudo"]
        return [*prefix, manager_path, "install", "-y", *packages]
    if manager == "dnf":
        prefix = [] if hasattr(os, "geteuid") and os.geteuid() == 0 else ["sudo"]
        return [*prefix, manager_path, "install", "-y", *packages]
    if manager == "pacman":
        prefix = [] if hasattr(os, "geteuid") and os.geteuid() == 0 else ["sudo"]
        return [*prefix, manager_path, "-S", "--needed", "--noconfirm", *packages]
    raise BootstrapError(f"Instalador não implementado para {manager}.")


def install_tool(tool: str, *, dry_run: bool = False, upgrade: bool = False) -> bool:
    if tool not in {"node", "blender", "krita"}:
        raise BootstrapError(f"Ferramenta desconhecida: {tool}")
    if platform.system() == "Linux" and get_package_manager()[0] == "apt-get":
        manager_path = get_package_manager()[1]
        prefix = [] if hasattr(os, "geteuid") and os.geteuid() == 0 else ["sudo"]
        update = [*prefix, manager_path or "apt-get", "update"]
        if dry_run:
            print(f"  $ {command_text(update)}")
        elif run_command(update).returncode != 0:
            print("  Aviso: apt-get update não concluiu; vou tentar instalar com o índice atual.")
    command = package_command(tool, upgrade=upgrade)
    print(f"  $ {command_text(command)}")
    if dry_run:
        return True
    result = run_command(command)
    return result.returncode == 0


def ask_yes_no(question: str, *, default: bool = True, assume_yes: bool = False) -> bool:
    if assume_yes:
        return True
    if not sys.stdin.isatty():
        print(f"  Sem terminal interativo; pulando: {question} (use --yes para instalar).")
        return False
    suffix = "[S/n]" if default else "[s/N]"
    try:
        answer = input(f"  {question} {suffix} ").strip().lower()
    except EOFError:
        return False
    if not answer:
        return default
    return answer in {"s", "sim", "y", "yes"}


def ensure_node_and_npm(*, yes: bool, dry_run: bool) -> bool:
    print_step("Dependências do painel")
    node = tool_status("node")
    npm = tool_status("npm")
    node_ok = node["installed"] and node_version_meets_minimum(node["version"])
    npm_ok = npm["installed"]
    if node_ok and npm_ok:
        print(f"  OK Node {node['version']} · {node['path']}")
        print(f"  OK npm {npm['version']} · {npm['path']}")
        return True
    if node["installed"] and not node_ok:
        print(f"  Node encontrado ({node['version']}), mas Electron 45 requer Node.js {MIN_NODE_VERSION_TEXT} ou superior.")
    if not node["installed"]:
        print("  Node.js não encontrado.")
    if not npm["installed"]:
        print("  npm não encontrado.")
    if not ask_yes_no("Instalar/atualizar Node.js e npm?", default=True, assume_yes=yes):
        raise BootstrapError("Node.js/npm são necessários para instalar as dependências e abrir o painel.")
    try:
        installed = install_tool("node", dry_run=dry_run, upgrade=node["installed"])
    except BootstrapError as exc:
        raise BootstrapError(f"Não consegui instalar Node.js: {exc}") from exc
    if dry_run:
        return True
    if not installed:
        raise BootstrapError("O instalador do Node.js falhou. Veja o comando acima e tente novamente.")
    # Some installers update PATH only for new processes. Check standard install locations too.
    node = tool_status("node")
    npm = tool_status("npm")
    if not node["installed"] or not node_version_meets_minimum(node["version"]) or not npm["installed"]:
        raise BootstrapError(
            f"Node.js {MIN_NODE_VERSION_TEXT}+ e npm ainda não estão disponíveis. Instale/atualize Node.js, "
            "feche e reabra o terminal se necessário, e rode ./lia-forge novamente."
        )
    print(f"  OK Node {node['version']} · npm {npm['version']}")
    return True


def electron_binary_path() -> Path:
    binary_root = ROOT / "node_modules" / "electron" / "dist"
    if platform.system() == "Windows":
        return binary_root / "electron.exe"
    if platform.system() == "Darwin":
        return binary_root / "Electron.app" / "Contents" / "MacOS" / "Electron"
    return binary_root / "electron"


def package_dependencies_ready() -> bool:
    package_file = ROOT / "package.json"
    lock_file = ROOT / "package-lock.json"
    modules_lock = ROOT / "node_modules" / ".package-lock.json"
    if not package_file.is_file() or not lock_file.is_file() or not modules_lock.is_file():
        return False
    try:
        expected = json.loads(lock_file.read_text(encoding="utf-8"))
        installed = json.loads(modules_lock.read_text(encoding="utf-8"))
        expected_packages = expected.get("packages", {})
        installed_packages = installed.get("packages", {})
        expected_root = expected_packages.get("", {})
        for section in ("dependencies", "devDependencies"):
            for dependency in expected_root.get(section, {}):
                key = f"node_modules/{dependency}"
                expected_entry = expected_packages.get(key, {})
                installed_entry = installed_packages.get(key, {})
                if not expected_entry or not installed_entry:
                    return False
                if expected_entry.get("version") != installed_entry.get("version"):
                    return False
                if not (ROOT / "node_modules" / dependency / "package.json").is_file():
                    return False
        return True
    except (OSError, json.JSONDecodeError, TypeError):
        return False


def ensure_npm_dependencies(*, dry_run: bool) -> None:
    print_step("Pacotes JavaScript")
    npm = find_executable("npm")
    if not npm:
        raise BootstrapError("npm não foi encontrado após a instalação do Node.js.")
    if not package_dependencies_ready():
        lock = ROOT / "package-lock.json"
        command = [npm, "ci"] if lock.is_file() else [npm, "install"]
        print("  Dependências ausentes ou desatualizadas; instalando pelo lockfile do repositório.")
        if dry_run:
            print(f"  $ {command_text(command)}")
            return
        run_command(command, cwd=ROOT, check=True)
    else:
        print("  OK Dependências do projeto já estão instaladas.")

    if electron_binary_path().is_file():
        print("  OK Runtime Electron pronto para abrir a janela desktop.")
        return
    install_runtime = [npm, "run", "postinstall"]
    print("  Runtime Electron ausente; vou preparar o binário desktop oficial.")
    if dry_run:
        print(f"  $ {command_text(install_runtime)}")
        return
    run_command(install_runtime, cwd=ROOT, check=True)
    if not electron_binary_path().is_file():
        raise BootstrapError("O instalador do Electron terminou sem criar o runtime desktop esperado.")


def ensure_recommended_apps(config: dict[str, Any], *, yes: bool, no_tools: bool, dry_run: bool) -> list[str]:
    recommended = config.get("bootstrap", {}).get("recommendedApps", ["blender", "krita"])
    if not isinstance(recommended, list):
        raise BootstrapError("bootstrap.recommendedApps precisa ser uma lista.")
    missing = [name for name in recommended if name in APP_INFO and not tool_status(name)["installed"]]
    if not missing:
        print_step("Apps de arte")
        print("  OK Blender/Krita já estão disponíveis (ou não foram solicitados na configuração).")
        return []
    print_step("Apps de arte recomendados")
    for name in missing:
        info = APP_INFO[name]
        print(f"  Ausente: {info['label']} — {info['purpose']}.")
    if no_tools:
        print("  Instalação opcional ignorada por --no-tools; o painel ainda pode ser aberto.")
        return missing
    if not ask_yes_no(f"Instalar agora: {', '.join(APP_INFO[name]['label'] for name in missing)}?", default=True, assume_yes=yes):
        print("  Apps ignorados. Instale-os depois com o gerenciador do seu sistema e rode doctor.")
        return missing
    not_installed: list[str] = []
    for name in missing:
        try:
            if not install_tool(name, dry_run=dry_run):
                not_installed.append(name)
                print(f"  Aviso: não consegui instalar {APP_INFO[name]['label']}; continuando sem ele.")
        except BootstrapError as exc:
            not_installed.append(name)
            print(f"  Aviso: {exc}; continuando sem {APP_INFO[name]['label']}.")
    if not_installed:
        return not_installed
    print("  Instalação concluída. Se algum app ainda não aparecer, abra um novo terminal e rode doctor.")
    return []


def model_slug(value: str) -> str:
    result = re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip(".-_")
    if not result or result in {".", ".."}:
        raise BootstrapError("ID de modelo inválido.")
    return result


def model_target_path(model: dict[str, Any]) -> Path:
    model_id = model_slug(str(model.get("id", "")))
    filename = str(model.get("filename", ""))
    if not filename or Path(filename).name != filename or filename in {".", ".."}:
        raise BootstrapError(f"Nome de arquivo inválido para o modelo {model_id}; use apenas um nome, sem pastas.")
    target = (MODEL_ROOT / model_id / filename).resolve()
    try:
        target.relative_to(MODEL_ROOT.resolve())
    except ValueError as exc:
        raise BootstrapError("O caminho do modelo tenta sair da pasta .spriteforge/models.") from exc
    return target


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def valid_model_checksum(model: dict[str, Any]) -> bool:
    expected = str(model.get("sha256", "")).lower()
    if not re.fullmatch(r"[0-9a-f]{64}", expected):
        raise BootstrapError(f"Modelo {model.get('id', '?')}: sha256 precisa ter 64 caracteres hexadecimais.")
    target = model_target_path(model)
    return target.is_file() and sha256_file(target) == expected


def verify_models(config: dict[str, Any], *, print_results: bool = True) -> tuple[int, int]:
    models = config.get("models", [])
    if not models:
        if print_results:
            print("  Nenhum peso configurado. Veja a seção 'models' em spriteforge.config.json.")
        return 0, 0
    ok = 0
    failed = 0
    for model in models:
        model_id = str(model.get("id", "?"))
        try:
            target = model_target_path(model)
            if valid_model_checksum(model):
                ok += 1
                if print_results:
                    print(f"  OK {model_id} · checksum válido · {target.relative_to(ROOT)}")
            else:
                failed += 1
                if print_results:
                    print(f"  FALTA/INVALIDADO {model_id} · esperado: {target.relative_to(ROOT)}")
        except (BootstrapError, OSError) as exc:
            failed += 1
            if print_results:
                print(f"  ERRO {model_id}: {exc}")
    return ok, failed


def accepted_license(model: dict[str, Any], *, yes: bool, config: dict[str, Any]) -> bool:
    if model.get("licenseAccepted") is True:
        return True
    license_url = model.get("licenseUrl") or "(sem URL informada; confira a licença na página oficial do modelo)"
    print(f"\n  Licença do modelo {model.get('id', '?')}: {license_url}")
    if yes:
        print("  --yes não aceita licenças automaticamente. Revise a licença e marque licenseAccepted=true no config.")
        return False
    if not ask_yes_no("Você leu e aceita os termos de uso deste peso?", default=False):
        return False
    model["licenseAccepted"] = True
    save_config(config)
    return True


def download_model(model: dict[str, Any]) -> None:
    model_id = model_slug(str(model.get("id", "")))
    url = str(model.get("url", ""))
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise BootstrapError(f"Modelo {model_id}: URL precisa ser HTTPS e pública.")
    expected = str(model.get("sha256", "")).lower()
    if not re.fullmatch(r"[0-9a-f]{64}", expected):
        raise BootstrapError(f"Modelo {model_id}: configure o SHA-256 oficial antes de baixar.")
    target = model_target_path(model)
    if valid_model_checksum(model):
        print(f"  OK {model_id} já está baixado e verificado.")
        return
    size = model.get("sizeBytes")
    target.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(size, int) and size > 0:
        free = shutil.disk_usage(target.parent).free
        if free < size + 50 * 1024 * 1024:
            raise BootstrapError(f"Espaço insuficiente para {model_id}: precisa de aproximadamente {size / 1024**3:.2f} GiB.")
    partial = target.with_name(target.name + ".download")
    request = urllib.request.Request(url, headers={"User-Agent": "LiaForgeBootstrap/0.1"})
    print(f"  Baixando {model_id} → {target.relative_to(ROOT)}")
    digest = hashlib.sha256()
    downloaded = 0
    last_report = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=45) as response, partial.open("wb") as output:
            total = int(response.headers.get("Content-Length", "0") or 0)
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
                digest.update(chunk)
                downloaded += len(chunk)
                now = time.monotonic()
                if now - last_report > 1.2:
                    if total:
                        print(f"\r  {downloaded / 1024**2:.0f}/{total / 1024**2:.0f} MiB", end="", flush=True)
                    else:
                        print(f"\r  {downloaded / 1024**2:.0f} MiB", end="", flush=True)
                    last_report = now
        print()
        actual = digest.hexdigest()
        if actual != expected:
            partial.unlink(missing_ok=True)
            raise BootstrapError(f"SHA-256 não confere para {model_id}. Arquivo parcial removido; nenhum peso foi instalado.")
        partial.replace(target)
        print(f"  OK {model_id} verificado · {downloaded / 1024**2:.1f} MiB")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        partial.unlink(missing_ok=True)
        raise BootstrapError(f"Falha ao baixar {model_id}: {exc}") from exc


def install_models(config: dict[str, Any], *, yes: bool, dry_run: bool = False) -> None:
    models = config.get("models", [])
    print_step("Pesos de modelos")
    if not models:
        print("  Nenhum peso foi baixado: ainda não há modelo escolhido no spriteforge.config.json.")
        print("  Configure URL HTTPS, SHA-256 e licença; pesos grandes/restritos não são baixados às cegas.")
        return
    for model in models:
        model_id = str(model.get("id", "?"))
        try:
            if valid_model_checksum(model):
                print(f"  OK {model_id} já existe e passou no SHA-256.")
                continue
            if dry_run and model.get("licenseAccepted") is not True:
                print(f"  Dry-run: exige revisão/aceite da licença ({model.get('licenseUrl') or 'URL não informada'}).")
                continue
            if not accepted_license(model, yes=yes, config=config):
                print(f"  Ignorado {model_id}; a licença ainda não foi aceita.")
                continue
            if dry_run:
                print(f"  Dry-run: baixaria {model.get('url', '(URL não configurada)')} → {model_target_path(model)}")
                continue
            if not yes and not ask_yes_no(f"Baixar o peso {model_id}?", default=True):
                print(f"  Ignorado {model_id}.")
                continue
            download_model(model)
        except (BootstrapError, OSError) as exc:
            print(f"  Aviso: {exc}")


def installed_project_dependencies() -> bool:
    return package_dependencies_ready()


def comfyui_server_status() -> dict[str, Any]:
    configured = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")
    try:
        parsed = urllib.parse.urlsplit(configured)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.username or parsed.password:
            raise ValueError("COMFYUI_URL precisa ser uma URL HTTP(S) sem credenciais.")
        endpoint = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))
        request = urllib.request.Request(f"{endpoint}/system_stats", headers={"Accept": "application/json"})
        with urllib.request.urlopen(request, timeout=1.2) as response:
            if response.status != 200:
                raise OSError(f"HTTP {response.status}")
            stats = json.loads(response.read().decode("utf-8"))
        system = stats.get("system", {}) if isinstance(stats, dict) else {}
        devices = stats.get("devices", []) if isinstance(stats, dict) else []
        return {
            "name": "comfyui",
            "running": True,
            "endpoint": endpoint,
            "version": system.get("comfyui_version") or stats.get("comfyui_version"),
            "devices": [device.get("name", "dispositivo sem nome") for device in devices if isinstance(device, dict)],
            "error": None,
        }
    except Exception as exc:
        return {
            "name": "comfyui",
            "running": False,
            "endpoint": configured,
            "version": None,
            "devices": [],
            "error": str(exc) or "ComfyUI indisponível.",
        }


def print_doctor(config: dict[str, Any], *, as_json: bool = False) -> int:
    statuses = {name: tool_status(name) for name in ("node", "npm", "blender", "krita", "claude", "codex", "opencode", "ollama", "comfy", "comfy-mcp")}
    statuses["comfyui"] = comfyui_server_status()
    electron_package = ROOT / "node_modules" / "electron" / "package.json"
    try:
        electron_version = json.loads(electron_package.read_text(encoding="utf-8")).get("version")
    except (OSError, json.JSONDecodeError):
        electron_version = None
    statuses["electron"] = {
        "name": "electron",
        "installed": electron_binary_path().is_file(),
        "path": str(electron_binary_path()) if electron_binary_path().is_file() else None,
        "version": electron_version,
        "major": None,
    }
    statuses["python"] = {
        "name": "python",
        "installed": True,
        "path": sys.executable,
        "version": platform.python_version(),
        "major": sys.version_info.major,
        "minor": sys.version_info.minor,
        "meetsMinimum": sys.version_info >= (3, 8),
    }
    statuses["node"]["minimumVersion"] = MIN_NODE_VERSION_TEXT
    statuses["node"]["meetsMinimum"] = statuses["node"]["installed"] and node_version_meets_minimum(statuses["node"]["version"])
    statuses["projectDependencies"] = {"installed": installed_project_dependencies()}
    ok_models, bad_models = verify_models(config, print_results=False)
    result = {
        "platform": platform.platform(),
        "packageManager": get_package_manager()[0],
        "tools": statuses,
        "models": {"configured": len(config.get("models", [])), "verified": ok_models, "missingOrInvalid": bad_models},
        "modelDirectory": str(MODEL_ROOT),
    }
    required_ready = (
        statuses["python"]["meetsMinimum"]
        and statuses["node"]["meetsMinimum"]
        and statuses["npm"]["installed"]
        and statuses["projectDependencies"]["installed"]
        and statuses["electron"]["installed"]
    )
    if as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if required_ready else 1
    print_step("Diagnóstico Lia Forge")
    print(f"  Sistema: {platform.system()} · gerenciador: {result['packageManager'] or 'não detectado'}")
    for name in ("python", "node", "npm", "electron", "blender", "krita", "claude", "codex", "opencode", "ollama", "comfy", "comfy-mcp", "comfyui"):
        state = statuses[name]
        label = APP_INFO.get(name, {}).get("label", TOOL_LABELS[name])
        if name == "python":
            ready = bool(state["meetsMinimum"])
            suffix = f"{state['version']} (mínimo 3.8)"
        elif name == "node":
            ready = bool(state["meetsMinimum"])
            suffix = f"{state['version']} (mínimo {MIN_NODE_VERSION_TEXT})" if state["installed"] else "não instalado"
        elif name == "electron":
            ready = bool(state["installed"])
            suffix = state["version"] if ready else "binário desktop não preparado"
        elif name == "comfyui":
            ready = bool(state["running"])
            suffix = f"em execução · {state['endpoint']}"
            if state.get("devices"):
                suffix += f" · dispositivo: {', '.join(state['devices'])}"
            if not ready:
                suffix = f"sem resposta · {state['endpoint']}"
        else:
            ready = bool(state["installed"])
            suffix = state["version"] if state["installed"] else "não instalado"
        marker = ("OK" if ready else "OPCIONAL") if name in {"claude", "codex", "blender", "krita", "opencode", "ollama", "comfy", "comfy-mcp", "comfyui"} else ("OK" if ready else "FALTA")
        print(f"  {marker} {label}: {suffix}")
        if state.get("path"):
            print(f"      {state['path']}")
    deps = statuses["projectDependencies"]["installed"]
    print(f"  {'OK' if deps else 'FALTA'} Pacotes do projeto: {'instalados' if deps else 'serão instalados por npm ci'}")
    if config.get("models"):
        print(f"  Pesos: {ok_models}/{len(config['models'])} verificado(s) em {MODEL_ROOT}")
    else:
        print("  Pesos: nenhum configurado (nenhum download automático sem escolha e licença).")
    return 0 if required_ready else 1


def setup(*, yes: bool, no_tools: bool, skip_models: bool, dry_run: bool) -> list[str]:
    config = load_config()
    ensure_node_and_npm(yes=yes, dry_run=dry_run)
    ensure_npm_dependencies(dry_run=dry_run)
    warnings = ensure_recommended_apps(config, yes=yes, no_tools=no_tools, dry_run=dry_run)
    if skip_models:
        print_step("Pesos de modelos")
        print("  Ignorados por --skip-models.")
    else:
        install_models(config, yes=yes, dry_run=dry_run)
    if warnings:
        print("\nApps opcionais ausentes: " + ", ".join(APP_INFO[name]["label"] for name in warnings))
    return warnings


def electron_executable() -> Path:
    candidate = electron_binary_path()
    if not candidate.is_file():
        raise BootstrapError("Electron não está pronto. Rode 'npm run postinstall' ou ./lia-forge setup novamente.")
    return candidate


def launch_desktop(port: int, project_root: Path) -> int:
    executable = electron_executable()
    environment = {
        **os.environ,
        "SPRITEFORGE_PROJECT_ROOT": str(project_root.expanduser().resolve()),
        "LIA_FORGE_DEV_PORT": str(port),
    }
    command = [str(executable), str(ROOT)]
    print_step("Abrindo a janela desktop Lia Forge")
    print("  O painel abre em uma janela própria; fechar a janela encerra o app.\n")
    process = subprocess.Popen(
        command,
        cwd=ROOT,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    try:
        assert process.stdout is not None
        for line in process.stdout:
            print(line, end="", flush=True)
        return process.wait()
    except KeyboardInterrupt:
        print("\n  Encerrando Lia Forge...")
        process.terminate()
        try:
            return process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            return process.wait()
    finally:
        if process.poll() is None:
            process.terminate()


def launch_panel(port: int, *, open_browser: bool = True) -> int:
    npm = find_executable("npm")
    if not npm:
        raise BootstrapError("npm não encontrado. Rode ./lia-forge setup primeiro.")
    command = [npm, "run", "dev", "--", "--port", str(port)]
    print_step("Abrindo o painel web da Lia Forge")
    print("  Use Ctrl+C para encerrar o servidor local.\n")
    project_root = Path(os.environ.get("SPRITEFORGE_PROJECT_ROOT") or Path.cwd()).expanduser().resolve()
    process = subprocess.Popen(
        normalized_command(command),
        cwd=ROOT,
        env={**os.environ, "SPRITEFORGE_PROJECT_ROOT": str(project_root)},
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    opened = False
    try:
        assert process.stdout is not None
        for line in process.stdout:
            print(line, end="", flush=True)
            if not opened:
                match = re.search(r"Local:\s+(https?://\S+)", line)
                if match:
                    url = match.group(1).rstrip()
                    opened = True
                    print(f"\n  Painel pronto: {url}")
                    if not open_browser:
                        print("  Modo agent/headless: navegador não foi aberto.")
                        print(f"  URL do painel: {url}")
                    else:
                        try:
                            browser_opened = webbrowser.open(url, new=2)
                            if not browser_opened:
                                print("  Não encontrei um navegador padrão; abra manualmente:")
                                print(f"  {url}")
                        except Exception as exc:  # Browser launch is a convenience, not a server dependency.
                            print(f"  Não consegui abrir o navegador automaticamente: {exc}")
                            print(f"  Abra manualmente: {url}")
        return process.wait()
    except KeyboardInterrupt:
        print("\n  Encerrando o servidor Lia Forge...")
        process.terminate()
        try:
            return process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            return process.wait()
    finally:
        if process.poll() is None:
            process.terminate()


def show_dry_run(config: dict[str, Any], *, no_tools: bool, skip_models: bool) -> None:
    print_step("Plano (nenhuma alteração será feita)")
    if not tool_status("node")["installed"]:
        try:
            print(f"  Node: {command_text(package_command('node'))}")
        except BootstrapError as exc:
            print(f"  Node: instalação manual necessária ({exc})")
    if not installed_project_dependencies():
        print("  Dependências web/desktop: npm ci")
    elif not electron_binary_path().is_file():
        print("  Runtime Electron desktop: npm run postinstall")
    recommended = config.get("bootstrap", {}).get("recommendedApps", ["blender", "krita"])
    missing = [name for name in recommended if name in APP_INFO and not tool_status(name)["installed"]]
    if no_tools:
        print("  Apps Blender/Krita: ignorados por --no-tools")
    else:
        for name in missing:
            try:
                print(f"  {APP_INFO[name]['label']}: {command_text(package_command(name))}")
            except BootstrapError as exc:
                print(f"  {APP_INFO[name]['label']}: instalação manual necessária ({exc})")
    if skip_models or not config.get("models"):
        print("  Pesos de modelos: nenhum download")
    else:
        print(f"  Pesos configurados: {len(config['models'])}; verificar checksum/licença antes de baixar")
    print("  Janela desktop: Electron (npm run desktop); use --web para abrir o painel em navegador.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lia-forge",
        description="Verifica o PC, prepara dependências locais e abre a janela desktop Lia Forge.",
        epilog="Sem argumentos, executa o fluxo completo. Use 'doctor' para somente verificar o que já está instalado.",
    )
    parser.add_argument("command", nargs="?", choices=["run", "setup", "doctor", "models", "mcp-install"], help="run (padrão), setup, doctor, models ou mcp-install")
    parser.add_argument("models_action", nargs="?", choices=["list", "install", "verify"], help="ação para o comando models")
    parser.add_argument("--yes", action="store_true", help="responde sim para instalações/downloads recomendados (não aceita licenças de modelos automaticamente)")
    parser.add_argument("--no-tools", action="store_true", help="não instalar Blender/Krita; Node e dependências do painel continuam necessários")
    parser.add_argument("--skip-models", action="store_true", help="não baixar pesos configurados nesta execução")
    display_mode = parser.add_mutually_exclusive_group()
    display_mode.add_argument("--web", action="store_true", help="abre o painel em uma guia do navegador em vez da janela desktop")
    display_mode.add_argument("--no-browser", action="store_true", help="inicia apenas o servidor web para uso por agente, sem janela")
    parser.add_argument("--dry-run", action="store_true", help="mostra o plano sem instalar, baixar ou iniciar o painel")
    parser.add_argument("--json", action="store_true", help="saída JSON para doctor")
    parser.add_argument("--port", type=int, default=5173, help="porta de desenvolvimento do painel (padrão: 5173)")
    parser.add_argument("--client", choices=["claude", "codex", "opencode"], help="cliente MCP para mcp-install")
    parser.add_argument("--project-root", type=Path, help="raiz do projeto de jogo/workspace (padrão: diretório atual)")
    return parser


def main(argv: list[str] | None = None) -> int:
    if sys.version_info < (3, 8):
        print("ERRO: Lia Forge precisa de Python 3.8 ou superior.", file=sys.stderr)
        return 1
    parser = build_parser()
    args = parser.parse_args(argv)
    command = args.command or "run"
    try:
        config = load_config()
        if command == "doctor":
            return print_doctor(config, as_json=args.json)
        if command == "models":
            action = args.models_action or "list"
            print_step(f"Pesos de modelos · {action}")
            if action == "list":
                models = config.get("models", [])
                if not models:
                    print("  Nenhum peso configurado. Edite a lista 'models' em spriteforge.config.json.")
                for model in models:
                    target = model_target_path(model)
                    exists = valid_model_checksum(model)
                    print(f"  {'OK' if exists else 'FALTA'} {model.get('id', '?')} · {target.relative_to(ROOT)}")
                    print(f"      licença aceita: {'sim' if model.get('licenseAccepted') else 'não'}")
                return 0
            if action == "verify":
                _, failed = verify_models(config)
                return 0 if failed == 0 else 1
            install_models(config, yes=args.yes, dry_run=args.dry_run)
            return 0
        if command == "mcp-install":
            if not args.client:
                parser.error("mcp-install requer --client claude|codex|opencode")
            project_root = (args.project_root or Path.cwd()).expanduser().resolve()
            if args.dry_run:
                target = {
                    "claude": project_root / ".mcp.json",
                    "codex": project_root / ".codex" / "config.toml",
                    "opencode": project_root / "opencode.json",
                }[args.client]
                print_step("Plano de instalação MCP (nenhuma alteração será feita)")
                print(f"  Cliente: {args.client}")
                print(f"  Workspace: {project_root}")
                print(f"  Configuração: {target}")
                print(f"  Servidor: {ROOT / 'scripts' / 'spriteforge-mcp.mjs'}")
                return 0
            ensure_node_and_npm(yes=args.yes, dry_run=False)
            ensure_npm_dependencies(dry_run=False)
            try:
                from scripts.mcp_config import install_mcp_config
            except ImportError:
                from mcp_config import install_mcp_config
            try:
                changed, target = install_mcp_config(args.client, project_root)
            except OSError as exc:
                raise BootstrapError(f"Não consegui gravar a configuração MCP no workspace: {exc}") from exc
            print_step("Configuração MCP Lia Forge")
            print(f"  {'Instalado' if changed else 'Já configurado'} para {args.client}: {target}")
            print("  O cliente inicia o servidor MCP por stdio; reinicie/abra o workspace para carregar as ferramentas.")
            if args.client == "codex":
                print("  Codex só carrega a configuração de projeto após marcar/confiar neste workspace, conforme as regras do cliente.")
            return 0
        if args.dry_run:
            show_dry_run(config, no_tools=args.no_tools, skip_models=args.skip_models)
            return 0
        if command in {"run", "setup"}:
            setup(yes=args.yes, no_tools=args.no_tools, skip_models=args.skip_models, dry_run=False)
            if command == "setup":
                print("\nSetup concluído. Rode ./lia-forge para abrir a janela desktop.")
                return 0
            project_root = (args.project_root or Path.cwd()).expanduser().resolve()
            if args.no_browser:
                return launch_panel(args.port, open_browser=False)
            if args.web:
                return launch_panel(args.port, open_browser=True)
            return launch_desktop(args.port, project_root)
        parser.error(f"comando desconhecido: {command}")
    except BootstrapError as exc:
        print(f"\nERRO: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nOperação cancelada.", file=sys.stderr)
        return 130
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
