"""Regenerate THIRD_PARTY_NOTICES.md from the npm lockfile and installed metadata."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PACKAGE_FILE = ROOT / "package.json"
LOCK_FILE = ROOT / "package-lock.json"
OUTPUT_FILE = ROOT / "THIRD_PARTY_NOTICES.md"
DIRECT_PURPOSES = {
    "@modelcontextprotocol/sdk": ("runtime", "Servidor e ferramentas MCP opcionais."),
    "lucide-react": ("runtime", "Ícones da interface."),
    "react": ("runtime", "Runtime da interface."),
    "react-dom": ("runtime", "Renderização React no navegador/Electron."),
    "zod": ("runtime", "Validação de estruturas e mensagens."),
    "@vitejs/plugin-react": ("build/dev", "Integração React no build/desenvolvimento Vite."),
    "electron": ("runtime/distribuição", "Runtime desktop Electron empacotado no aplicativo."),
    "electron-builder": ("build/dev", "Empacotamento de distribuição desktop."),
    "vite": ("build/dev", "Servidor de desenvolvimento e build da interface."),
}


def read_manifest(package_path: str) -> dict[str, Any]:
    manifest = ROOT / package_path / "package.json"
    if not manifest.is_file():
        return {}
    try:
        value = json.loads(manifest.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def repository_url(package_path: str, package_name: str, manifest: dict[str, Any]) -> str:
    repository: Any = manifest.get("repository")
    if isinstance(repository, dict):
        repository = repository.get("url")
    if repository:
        url = str(repository).strip()
        if url.startswith("git+ssh://git@github.com/"):
            url = "https://github.com/" + url[len("git+ssh://git@github.com/"):]
        elif url.startswith("git+"):
            url = url[4:]
        if url.startswith("git://"):
            url = "https://" + url[len("git://"):]
        if url.startswith("github:"):
            url = "https://github.com/" + url[len("github:"):]
        if url.endswith(".git"):
            url = url[:-4]
        return url
    if package_name.startswith("@") and "/" in package_name:
        scope, name = package_name.split("/", 1)
        return f"https://www.npmjs.com/package/{scope}/{name}"
    return f"https://www.npmjs.com/package/{package_name}"


def generate() -> int:
    package = json.loads(PACKAGE_FILE.read_text(encoding="utf-8"))
    lock = json.loads(LOCK_FILE.read_text(encoding="utf-8"))
    direct: dict[str, str] = {}
    for group in ("dependencies", "devDependencies"):
        for name in package.get(group, {}):
            direct[name] = DIRECT_PURPOSES.get(name, ("runtime" if group == "dependencies" else "build/dev", "Dependência direta do projeto."))[0]

    rows: list[str] = []
    for package_path, metadata in sorted(lock.get("packages", {}).items()):
        if not package_path.startswith("node_modules/"):
            continue
        name = package_path[len("node_modules/"):].split("/node_modules/")[-1]
        version = metadata.get("version", "?")
        license = metadata.get("license", "not declared")
        manifest = read_manifest(package_path)
        is_direct_package = name in direct and package_path == f"node_modules/{name}"
        if is_direct_package:
            phase = direct[name]
            purpose = DIRECT_PURPOSES.get(name, (phase, "Dependência direta do projeto."))[1]
            kind = f"Direta — {phase}"
        else:
            phase = "runtime/app" if not metadata.get("dev", False) else "build/dev"
            description = " ".join(str(manifest.get("description", "")).split()).replace("|", "\\|")[:160]
            purpose = f"{description} (dependência transitiva de {phase})." if description else f"Dependência transitiva da árvore npm ({phase}); ver `package-lock.json`."
            kind = f"Transitiva — {phase}"
        source = repository_url(package_path, name, manifest)
        rows.append(
            f"| [`{name}`]({source}) (`{package_path}`) | `{version}` | `{license}` | {kind} — {purpose} | "
            "Conforme a licença indicada; preservar avisos e atribuições exigidos. |"
        )

    header = f'''# Avisos de dependências de terceiros

Atualizado a partir de `package-lock.json` (lockfile v3). A tabela registra **{len(rows)} pacotes** npm resolvidos, com versão exata, repositório (ou página npm quando o pacote não declara um), metadado de licença e finalidade direta ou transitiva. A árvore fixada é reproduzida por `npm ci`.

**Escopo da redistribuição:** `package.json` e o filtro do `electron-builder` definem o que entra no aplicativo; dependências de build/teste não são necessariamente copiadas para o instalador. Nenhum pacote Windows foi produzido nesta sessão, portanto a composição final do instalador ainda deve ser inspecionada no gate Windows. O metadado `license` do lockfile é um índice, não substitui a revisão do texto completo nem o `NOTICE`/aviso distribuído pelo pacote.

O código próprio está sob MIT em [`LICENSE`](LICENSE). Nome, marca e arquivos `assets/lia-forge.svg` e `assets/lia-forge.ico` **não** recebem licença pela MIT deste repositório; direitos de terceiros também continuam regidos por seus avisos originais.

| Pacote / caminho no lockfile | Versão fixada | Licença declarada no lockfile | Finalidade/escopo | Redistribuição/atribuição |
|---|---:|---|---|---|
'''
    OUTPUT_FILE.write_text(header + "\n".join(rows) + "\n", encoding="utf-8")
    print(f"Atualizado {OUTPUT_FILE.relative_to(ROOT)} com {len(rows)} dependências.")
    return 0


if __name__ == "__main__":
    raise SystemExit(generate())
