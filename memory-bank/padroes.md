# Padrões — Lia Forge

O que a sessão precisa saber para não repetir investigações já feitas.

## Stack

- Electron (processo principal CommonJS), React 18, Vite 6 e Node.js >=22.12.
- Python 3.8+ stdlib para bootstrap/config auxiliar; `scripts/blender_spritesheet.py` roda dentro do Blender e usa `bpy` do Blender.
- Manter o stack existente. O build Electron não deve depender de Python instalado no usuário final.

## Comandos de verificação

| Alteração | Rode |
|---|---|
| Electron, adapters e UI | `npm test` |
| CSS/React/build | `npm run build` |
| Launcher e config Python | `python -m unittest discover -s tests -v` |
| Mudou dependências npm | `npm ci --ignore-scripts` e `python scripts/generate_third_party_notices.py`; revisar licenças e diferenças do lockfile |
| Antes de entregar | os três comandos acima + `python -m py_compile scripts/*.py tests/*.py` + `node --check` nos arquivos Node + `git diff --check` |

`npm ci --ignore-scripts` prepara a árvore de dependências sem executar scripts de instalação do Electron; isso **não** instala ComfyUI, ferramentas externas ou pesos. Execute `npm ci` normal só quando precisar testar o postinstall/build desktop.

## O que conta como prova de que funciona

- **Conta:** execução no Windows real do instalador e do app, com paths e fechamento conferidos. Blender/ComfyUI exigem execução real com instalação/endereço do próprio usuário.
- **Não conta:** teste unitário/smoke, build Vite, revisão de código ou servidor ComfyUI simulado.
- PNG/JSON estruturalmente válido não comprova qualidade visual, transparência efetiva ou semântica do rig.

## Convenções

- Texto ao usuário em pt-BR; comentários podem acompanhar o idioma do módulo existente.
- Nome do produto `Lia Forge`; identidade e ícones não recebem licença MIT do código.
- O usuário pode escolher `SPRITEFORGE_PROJECT_ROOT`; o Electron empacotado sem override usa `LIA_HOME/Forge` ou o padrão `~/Lia/Forge`.
- `LIA_MODELOS` aponta para o diretório compartilhável. O downloader auxiliar usa trava por arquivo e só recupera locks sem atividade após uma hora; isso não substitui catálogo/índice comum com outros gestores. Não versionar pesos, outputs locais, segredos ou aceites de licença.
- `.spriteforge/` e `spriteforge_*` permanecem por compatibilidade.
- `.claude/rules/` deve ser versionado; não ignorar a pasta `.claude/` inteira. Skills versionadas ficam em `.agents/skills/`.
- Processo/servidor externo só é parado se a Lia Forge o iniciou e a pessoa confirmou o fechamento.

## Armadilhas já pagas

| Sintoma | Causa | Conserto |
|---|---|---|
| App abre workspace vazio após trocar o padrão de pasta | Havia `Documents/Lia Forge` legado | Perguntar qual pasta abrir; não mover nem apagar sem fluxo explícito. |
| `Path.relative_to(ROOT)` falha ao baixar modelo | Modelos ficam fora do checkout | Mostrar e validar path absoluto dentro de `LIA_MODELOS`. |
| Marcar aceite no config versionado | Consentimento do usuário misturado a código | Persistir o aceite em `%APPDATA%/Lia/Forge/config`, vinculado ao ID, licença e SHA-256. |
| Confundir ComfyUI com provider ou Waifu bridge | Há apenas um adapter ComfyUI e nenhum protocolo Waifu | Nomear o adapter real, manter endpoint configurável e registrar limitações; não simular suporte genérico. |
| Smoke test verde interpretado como PASS Windows | Sandbox não executa Windows/Electron installer | Estado-alvo continua pendente até verificação manual na plataforma. |
