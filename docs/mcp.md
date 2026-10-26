# Lia Forge MCP e opção OpenCode + Ollama

O servidor MCP local da Lia Forge conecta um agente ao workspace do jogo quando o usuário escolhe delegar. **MCP/agente são opcionais:** no desktop, também é possível seguir manualmente, usar as próprias ferramentas e registrar arquivos reais pela UI. O servidor MCP roda por **stdio**: não abre uma porta de rede para o MCP, não chama um provider pago e não gera arte por conta própria. O ID de configuração e os nomes de ferramentas `spriteforge_*` são mantidos para compatibilidade.

## Instalação em um projeto

Pré-requisitos: Node.js 22.12+ e dependências do repositório instaladas. Se ainda não preparou a Lia Forge, rode `./lia-forge setup` uma vez. Depois, no terminal, vá para a raiz do projeto do jogo e use o caminho do checkout da Lia Forge:

```bash
cd /caminho/do/meu-jogo
/caminho/para/3DSpritesheet/lia-forge mcp-install --client opencode
```

Clientes aceitos: `claude`, `codex` e `opencode`. O comando instala uma configuração **só neste projeto**, preserva as demais entradas e não substitui uma entrada `spriteforge` conflitante:

| Cliente | Arquivo do projeto |
| --- | --- |
| Claude Code | `.mcp.json` |
| Codex | `.codex/config.toml` |
| OpenCode | `opencode.json` |

O servidor é iniciado pelo próprio cliente quando o workspace abre. Reinicie/reabra o agente após instalar. O Codex pode exigir que o projeto seja marcado como confiável antes de carregar configuração local.

Para conferir o que seria escrito sem alterar arquivos:

```bash
/caminho/para/3DSpritesheet/lia-forge mcp-install --client opencode --dry-run
```

O instalador de configuração prepara Node/dependências da Lia Forge se estiverem ausentes, mas não instala Claude Code, Codex, OpenCode, Ollama nem pesos de modelos.

## Ferramentas MCP

- `spriteforge_get_status` — caminhos do workspace, CLIs locais, Ollama, status do ComfyUI e limitações atuais.
- `spriteforge_comfyui_status` — consulta read-only a fila, dispositivos e categorias de modelos que o ComfyUI reporta; não envia nem cancela workflows.
- `spriteforge_list_comfyui_workflows` — lista os templates de conceito incluídos; não escolhe checkpoints.
- `spriteforge_list_free_models` — opções de modelos locais; somente catálogo, sem seleção/download.
- `spriteforge_list_assets` — briefs registrados no workspace.
- `spriteforge_create_asset` — cria personagem ou item (`weapon`, `tool`, `prop`, `consumable`) com animações, alvo, destino e ponto de entrada opcional no fluxo 3D → 2D.
- `spriteforge_add_reference` — copia uma imagem já existente no workspace (PNG/JPG/WEBP, até 20 MB); não busca imagens na internet.
- `spriteforge_prepare_task` — escreve o task JSON v2 e um prompt Markdown em `.spriteforge/tasks/<id>/`; retoma da primeira etapa pendente, acrescenta como insumos os outputs reais das etapas concluídas e respeita a etapa opcional de movimento pulada. Revalida todos os caminhos e só cria `brief.md` se a tarefa ainda começa pela direção de arte e o arquivo não existe.
- `spriteforge_update_stage` — registra estado, observações e outputs reais; exige outputs existentes para concluir e só verifica dependências a partir do `startStageIndex`. Etapas anteriores são ignoradas, não concluídas.
- `spriteforge_open_panel` — inicia o painel local, sem abrir uma janela do navegador.

Para iniciar de um ponto específico, `spriteforge_create_asset` aceita `workflowId: "3d_to_2d"`, `entryPointId` (`prompt`, `brief`, `concept`, `model` ou `rigged`), `startStageIndex` e `existingInputs` (`path` relativo ao projeto e `stageIndex` da etapa que produziu o artefato). Depois, `spriteforge_prepare_task` observa os estados concluídos no manifesto, continua na primeira etapa ainda pendente e inclui os outputs anteriores como insumos. Etapas ignoradas antes do ponto de entrada não são refeitas; a etapa opcional de movimento de item pode estar marcada como pulada. O MCP revalida cada caminho antes de preparar o handoff e não presume que arquivos fora do projeto foram copiados para ele.

O estado compartilhado fica em `.spriteforge/assets.json`; tasks, referências copiadas e logs ficam em `.spriteforge/`. Caminhos MCP são relativos à raiz do projeto e o servidor rejeita `..`, caminhos absolutos e saídas por links simbólicos para fora do workspace. A UI do Vite lê/salva o mesmo manifesto e atualiza mudanças feitas pelo MCP enquanto está aberta. Ao iniciar o painel manualmente para outro projeto, defina `SPRITEFORGE_PROJECT_ROOT` para a pasta do jogo; o launcher e a configuração MCP fazem isso automaticamente.

Decida com o seu projeto se `.spriteforge/` deve entrar no Git. O manifesto pode conter brief, prompts e referências locais; ele não contém tokens de provider.

## ComfyUI local

O diagnóstico consulta `COMFYUI_URL` (padrão `http://127.0.0.1:8188`) e informa fila, dispositivos, versão e nomes de checkpoints/LoRAs/VAEs/ControlNet disponíveis. A consulta não cria prompts, não cancela jobs e não baixa arquivos. Os templates `workflows/comfyui/lia-forge-*-concept-api.json` são grafos ComfyUI API de referência, com checkpoint placeholder. Revise [`comfyui.md`](./comfyui.md) antes de instalar ou escolher pesos.

Para executar workflows por um agente, considere o [`comfy-mcp`](https://github.com/Comfy-Org/comfy-mcp), servidor MCP local first-party da Comfy Org. Ele é separado do servidor MCP da Lia Forge e requer instalação/configuração explícita; a Lia Forge não instala nem registra esse servidor automaticamente.

## Alternativa sem Claude Code/Codex: OpenCode + Ollama

OpenCode é o agente de código; Ollama executa o modelo local. O modelo ajuda a trabalhar no repositório e delegar etapas de código, mas **não é um gerador de imagem nem um conversor image-to-3D**. A execução de mesh, rig e render ainda depende das ferramentas/adapters disponíveis.

1. Instale Node.js 22.12+ e OpenCode: `npm install --global opencode-ai` (ou siga a [documentação oficial do OpenCode](https://opencode.ai/docs/)).
2. Instale o Ollama pelo [download oficial](https://ollama.com/download) para seu sistema operacional.
3. Leia a licença e escolha um modelo de acordo com a memória disponível. Exemplos publicados no catálogo oficial do Ollama:

   | Modelo | Download aproximado | Licença listada | Observação |
   | --- | ---: | --- | --- |
   | [`qwen3:4b`](https://ollama.com/library/qwen3:4b) | 2,5 GB | Apache-2.0 | opção compacta de propósito geral; desempenho pode variar |
   | [`qwen2.5-coder:7b`](https://ollama.com/library/qwen2.5-coder:7b) | 4,7 GB | Apache-2.0 | opção focada em código |
   | [`qwen3:8b`](https://ollama.com/library/qwen3:8b) | 5,2 GB | Apache-2.0 | modelo geral com raciocínio/uso de ferramentas |
   | [`qwen3-coder:30b`](https://ollama.com/library/qwen3-coder:30b) | 19 GB | Apache-2.0 | pesado; não é recomendação padrão |

   Os tamanhos são dos pesos quantizados publicados e não equivalem à memória total necessária em execução. Contexto, quantização, runtime e hardware afetam RAM/VRAM; a Lia Forge não presume uma GPU nem escolhe um modelo. As licenças podem mudar: confira a página do modelo antes de aceitar. Por exemplo, o `qwen2.5-coder:3b` consultado tem uma licença de pesquisa com restrição a uso não comercial, então não é listado como padrão para projetos de jogo.

4. Só depois de escolher/revisar a licença, baixe explicitamente um modelo, por exemplo:

   ```bash
   ollama pull qwen2.5-coder:7b
   ```

   O bootstrap da Lia Forge não executa esse comando, não configura pesos por padrão e não baixa pesos às cegas.

5. De dentro do projeto do jogo, instale o MCP e adicione o provider Ollama ao `opencode.json` existente. O comando MCP preserva outras chaves. O bloco abaixo é **somente um exemplo opcional**, não uma escolha padrão da Lia Forge; configure-o apenas depois de selecionar e baixar um modelo:

   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "provider": {
       "ollama": {
         "npm": "@ai-sdk/openai-compatible",
         "name": "Ollama (local)",
         "options": { "baseURL": "http://localhost:11434/v1" },
         "models": {
           "qwen2.5-coder:7b": { "name": "Qwen2.5 Coder 7B (local)" }
         }
       }
     }
   }
   ```

   Mescle esse bloco `provider` com o `opencode.json` criado pelo comando de instalação MCP; mantenha a chave `mcp`. Depois, ainda na raiz do projeto:

   ```bash
   opencode --model ollama/qwen2.5-coder:7b
   ```

A documentação do [provider Ollama no OpenCode](https://opencode.ai/docs/providers/) descreve a configuração compatível com OpenAI em `http://localhost:11434/v1`. Para encerrar, pare o agente/painel como qualquer outro processo local. Nenhum peso é baixado por este exemplo até você executar `ollama pull` explicitamente.