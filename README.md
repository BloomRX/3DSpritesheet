# Lia Forge — Game Asset Studio

A Lia Forge organiza briefs e handoffs para produzir **personagens e itens/armas/ferramentas** por 3D → 2D. O usuário pode entrar do zero (prompt com referência opcional) ou retomar de conceitos, poses, modelos 3D e rigs existentes, sem refazer etapas anteriores. Veja [`docs/usage-workflows.md`](docs/usage-workflows.md) para o fluxo-alvo e rotas previstas.

## Abrir em janela desktop

No macOS/Linux:

```bash
./lia-forge
```

No Windows:

```powershell
.\lia-forge.cmd
```

O bootstrap detecta Python 3.8+, Node.js 22.12+, npm, Blender (incluindo instalações em bibliotecas Steam no Windows), Krita e os agentes/runtimes já instalados. Instala as dependências do projeto quando necessário e abre uma janela própria Electron — sem misturar o painel com as guias do navegador. O launcher antigo `spriteforge` / `spriteforge.cmd` continua como alias de compatibilidade.

No primeiro uso, Blender e Krita são opcionais e o bootstrap pede confirmação antes de instalá-los. A instalação das dependências Electron precisa baixar o runtime oficial do Electron. O bootstrap **não instala ComfyUI, drivers, `comfy-mcp`, modelos ou pesos**.

### Diagnóstico e modos alternativos

```bash
./lia-forge doctor          # detecta ferramentas e consulta a API local do ComfyUI; não instala
./lia-forge setup           # prepara as dependências, sem abrir o app
./lia-forge --web           # abre o painel web no navegador
./lia-forge --no-browser    # inicia somente o servidor web para um agente
./lia-forge --dry-run       # mostra o plano sem instalar/baixar/iniciar
./lia-forge models list     # lista pesos configurados (vazia por padrão)
./lia-forge models verify  # valida checksums dos pesos configurados
```

Com a janela desktop aberta, feche pelo botão X. Se houver atividade registrada, a Lia Forge mostra uma confirmação com as tarefas e processos encontrados. Ao confirmar, encerra somente processos que **ela própria iniciou**. Filas e agentes externos — inclusive jobs de uma instância ComfyUI que já estava rodando — são identificados como externos e não são interrompidos.

O workspace usa o diretório atual quando iniciado pelo launcher (`SPRITEFORGE_PROJECT_ROOT`). Um executável instalado sem essa variável usa `Documents/Lia Forge`. O formato/caminho histórico `.spriteforge/` e o namespace `spriteforge_*` do MCP são mantidos para compatibilidade com workspaces e configurações existentes.

## Executável Windows

A configuração de empacotamento Electron está pronta:

```powershell
npm ci
npm run package:win
```

O instalador NSIS sai em `release/`; para um executável portátil, use `npm run package:win:portable`. O empacotamento deve ser executado e validado em Windows com arquitetura x64. **Nenhum `.exe` foi produzido ou assinado neste workspace.**

## ComfyUI, workflows e AMD

A tela **Atividade & ComfyUI** consulta (somente leitura) o endpoint local padrão `http://127.0.0.1:8188`: conexão, fila, dispositivos informados pelo ComfyUI e categorias de modelos/checkpoints instalados. Para outro endereço local configurado pelo usuário, use `COMFYUI_URL`.

Há dois workflows JSON de conceito, em `workflows/comfyui/`: um para personagem e outro para item. Eles precisam de um checkpoint compatível escolhido manualmente; usam um placeholder proposital e não baixam pesos. São referências de imagem, não geram 3D, rig, animações ou spritesheet.

Para integração de agentes com ComfyUI, veja [`docs/comfyui.md`](docs/comfyui.md) e o servidor local first-party [`comfy-mcp`](https://github.com/Comfy-Org/comfy-mcp). Nenhum setup ComfyUI/MCP é executado automaticamente.

**GPU AMD:** ROCm só deve ser escolhido quando a GPU exata, o sistema e o runtime forem compatíveis. Ex.: RX 580/Polaris GCN 4.0 não entra no ROCm oficial atual do ComfyUI. Vulkan via `stable-diffusion.cpp` é uma alternativa de geração separada — não um backend que possamos forçar no ComfyUI — e ainda requer integração/validação. O fluxo completo também precisa oferecer instalação local oficial do ComfyUI com consentimento e rotas por hardware; veja [`docs/comfyui.md`](docs/comfyui.md). Nenhuma GPU, driver, ComfyUI ou peso foi instalado neste ambiente.

## Pesos de modelos

A lista `models` em [`spriteforge.config.json`](spriteforge.config.json) fica vazia deliberadamente. Antes de adicionar pesos, escolha provider/modelo e revise origem HTTPS, checksum SHA-256, licença, tamanho e compatibilidade de hardware. Um registro de peso precisa incluir `licenseUrl`, `sha256`, URL HTTPS e `licenseAccepted: true`; downloads incompletos não são mantidos.

Os arquivos configurados ficam em `.spriteforge/models/`, ignorado pelo Git. O downloader não aceita pesos sem checksum e não marca licenças como aceitas automaticamente.

## Funcionalidades atuais

- UI Lia Forge magenta/rosa, preto e branco, em janela desktop isolada ou modo web.
- Workspace para personagens e itens com briefs, imagens de referência, escolha do ponto de entrada no fluxo 3D → 2D, caminhos de artefatos existentes, animações e destinos planejados.
- Indicadores de atividade local, tarefas registradas via MCP, fila ComfyUI e dispositivos reportados.
- Workflows ComfyUI de conceito exportáveis, sem checkpoint selecionado.
- Handoff estruturado para Claude Code, Codex, OpenCode ou outro agente, com JSON de tarefa e contrato de saídas.
- Servidor MCP para briefs, tarefas e validação de saídas reais; ferramentas `spriteforge_*` mantidas por compatibilidade.
- Armazenamento local: `.spriteforge/assets.json` no projeto/workspace; executável instalado sem projeto usa `Documents/Lia Forge`.

## O que ainda não executa

A Lia Forge ainda não inicia agentes, não envia workflows ao ComfyUI e não gera imagens, modelos 3D, rigs, animações nem spritesheets. O botão do stage workspace prepara o handoff; uma etapa só pode ser registrada como concluída pelo MCP depois que os outputs reais existem e são verificados. Os caminhos de artefatos existentes são validados pelo MCP quando o handoff é preparado.

O app fornece interface, organização, status e handoff. A execução ainda depende de ferramentas/adapters escolhidos e instalados pelo usuário. Nenhum peso, licença ou GPU é presumido.

## Integração de agentes e testes

Instale a configuração MCP por projeto, a partir do root do jogo:

```bash
/caminho/para/3DSpritesheet/lia-forge mcp-install --client claude
/caminho/para/3DSpritesheet/lia-forge mcp-install --client codex
/caminho/para/3DSpritesheet/lia-forge mcp-install --client opencode
```

Veja [`docs/mcp.md`](docs/mcp.md), [`docs/agent-workflow.md`](docs/agent-workflow.md), [`docs/usage-workflows.md`](docs/usage-workflows.md) e [`docs/asset-task.schema.json`](docs/asset-task.schema.json).

Para validar o projeto:

```bash
npm ci
npm test
python -m unittest discover -s tests -v
npm run build
```
