# Lia Forge + ComfyUI

## Estado e limites

A Lia Forge agora consegue **consultar** uma instância ComfyUI local: conexão, fila, dispositivos reportados pelo ComfyUI e nomes de checkpoints/LoRAs/VAEs/ControlNet instalados. O painel e o MCP não instalam ComfyUI, não enviam prompts para a fila e não baixam pesos. A configuração de modelos do pack continua vazia (`models: []`); não há modelo escolhido nem download automático.

A consulta usa a API HTTP local do ComfyUI. Por padrão, procura `http://127.0.0.1:8188`; para uma instância em outra URL, configure `COMFYUI_URL`. O endereço configurado precisa ser HTTP(S). As rotas de leitura usadas são `/system_stats`, `/queue` e `/models/{checkpoints,loras,vae,controlnet}`. O diagnóstico só informa dispositivos que o próprio ComfyUI reporta — não presume GPU, VRAM ou backend.

A tela **Atividade & ComfyUI** diferencia tarefas em execução, fila externa, status do servidor e workflows de exemplo. Fechar a Lia Forge não interrompe trabalhos de uma instância ComfyUI que ela não iniciou; a confirmação de fechamento os identifica como externos.

## Comfy MCP oficial para agentes

A Comfy Org publica o [`comfy-mcp`](https://github.com/Comfy-Org/comfy-mcp), servidor MCP local first-party para consultar um workspace ComfyUI e executar workflows por meio do `comfy-cli`. É uma opção preferencial para Claude Code, Codex, Cursor e outros clientes MCP quando a geração local for autorizada. A documentação oficial lista Python 3.10+, `comfy-cli` 1.14+ e um workspace ComfyUI como requisitos; as ferramentas de execução precisam de uma instância ComfyUI ativa. O MCP oficial não inicia o servidor implicitamente.

A instalação, criação/seleção do workspace e registro no agente **não são automáticos** nesta etapa. Se você escolher essa integração, siga as instruções atuais do projeto oficial e confira o caminho do `comfy` usado pelo cliente:

```bash
pip install "comfy-cli>=1.14.0"
comfy install
pip install comfy-mcp
comfy launch
```

Exemplo oficial para registrar no Claude Code (se `comfy` já estiver no `PATH`, `COMFY_BIN` pode ser omitido):

```bash
claude mcp add comfy-mcp -e COMFY_BIN=/caminho/absoluto/para/comfy -- comfy-mcp
```

A Lia Forge não instala esses pacotes nem edita configuração de agente sem solicitação. O `comfy-mcp` é um servidor MCP separado; os recursos atuais do MCP Lia Forge continuam focados em briefs, assets e handoff.

## Modelos e pesos

O ComfyUI é o motor de workflows, não um pacote de pesos: modelos geralmente precisam ser obtidos separadamente e podem ocupar vários GB. Categorias comuns incluem:

| Categoria | Pasta habitual | Uso |
| --- | --- | --- |
| Checkpoint | `ComfyUI/models/checkpoints/` | Pesos principais de famílias de geração compatíveis com o workflow |
| LoRA | `ComfyUI/models/loras/` | Adaptador de estilo/personagem, normalmente adicional a um modelo base |
| VAE | `ComfyUI/models/vae/` | Codificação/decodificação de imagem quando o modelo/workflow usa VAE separado |
| ControlNet | `ComfyUI/models/controlnet/` | Condicionamento por pose, bordas, profundidade ou outros controles |

A família do modelo determina os loaders, dimensões, precisão e requisitos. Um checkpoint não é necessariamente compatível com qualquer workflow ou `CheckpointLoaderSimple`; workflows podem exigir text encoders, VAE, LoRA, ControlNet ou nós extras. O ComfyUI lista os arquivos que o servidor reconhece e a própria biblioteca de templates pode mostrar dependências ausentes.

Antes de configurar qualquer peso, escolha-o com base no sistema operacional, GPU/VRAM, tamanho em disco, origem HTTPS, checksum e licença. Nenhum modelo foi escolhido ou baixado nesta implementação. Os arquivos de exemplo abaixo usam o valor `__SELECT_A_COMPATIBLE_CHECKPOINT__` de propósito; ele **não** é um checkpoint instalado e precisa ser substituído por um nome compatível antes de executar.

## Workflows incluídos

Os dois exemplos estão em `workflows/comfyui/` e também aparecem na tela **Atividade & ComfyUI**:

- `lia-forge-character-concept-api.json` — conceito de personagem com exploração de vistas.
- `lia-forge-item-concept-api.json` — conceito de arma, ferramenta ou prop.

São grafos API simples (`CheckpointLoaderSimple → CLIPTextEncode → KSampler → VAEDecode → SaveImage`), sem pesos. O formato API é próprio para envio ao servidor e não contém o layout visual completo do canvas. No ComfyUI, workflows de canvas podem ser exportados por **File → Export Workflow (API)**.

Esses prompts de conceito são apenas um primeiro rascunho: modelos de imagem podem variar identidade, pose, proporções e vistas. Eles não substituem validação de uma folha ortográfica nem produzem GLB/FBX, rig, animações ou spritesheet. A Lia Forge não marca essas etapas como concluídas porque uma imagem foi gerada.

## Detecção de hardware e escolha do backend

A instalação futura precisa detectar sistema operacional, GPUs presentes, modelo/arquitetura quando identificável, VRAM reportada, driver e runtimes de aceleração já instalados. A seleção deve usar a matriz oficial da versão escolhida do ComfyUI; não basta olhar o fabricante ou a VRAM. Se o hardware não puder ser identificado com confiança, a Lia Forge deve mostrar as opções e pedir uma escolha, não adivinhar.

| Perfil detectado | Caminho recomendado | Regra da Lia Forge |
| --- | --- | --- |
| NVIDIA compatível | ComfyUI com PyTorch/CUDA compatíveis | Usar o runtime CUDA correto para a geração da GPU; testar que o servidor lista o dispositivo. |
| AMD em arquitetura/OS cobertos oficialmente | ComfyUI com ROCm compatível | Só oferecer ROCm se GPU, OS e versão do pacote estiverem na matriz aplicável. A documentação consultada indica ROCm 7.2 no Linux e ROCm 10.0 no Windows para GPUs listadas. |
| Intel ou Apple Silicon compatível | Backend oficial da plataforma (XPU/Metal) | Só selecionar depois de verificar sistema, runtime e dispositivo reportado. |
| GPU/runtimes desconhecidos ou sem suporte confirmado | Escolha manual; CPU como opção de compatibilidade | Nunca mostrar “aceleração GPU ativa” sem uma checagem pós-instalação. CPU é explícito e pode ser mais lento. |

**RX 580 8 GB como exemplo:** a capacidade de VRAM não garante compatibilidade de compute. A RX 580 é Polaris/GCN 4.0; um colaborador do ComfyUI declarou que o suporte ROCm começa em GCN 5.0, portanto ela não deve entrar no caminho oficial ROCm atual por inferência de nome ou VRAM ([discussão no repositório do ComfyUI](https://github.com/Comfy-Org/ComfyUI/issues/14780)). A GPU ainda pode ser útil, mas requer outro backend validado.

### Vulkan: alternativa de geração, não backend do ComfyUI

O ComfyUI padrão é baseado em PyTorch e não oferece um backend Vulkan oficial documentado. Não devemos passar um `--vulkan` inventado nem trocar o backend dentro de uma instalação ComfyUI. Há, porém, um caminho distinto: [`stable-diffusion.cpp`](https://github.com/leejet/stable-diffusion.cpp) implementa backends Vulkan e oferece `sd-server`. Isso pode ser uma alternativa de geração de imagens para GPUs legadas como a RX 580, desde que a Lia Forge integre e valide esse motor separadamente.

Esse caminho **não executa workflows, custom nodes ou modelos específicos do ComfyUI** sem adaptação. Ele tem seu próprio suporte a modelos/formats, API e limitações; qualquer adaptador Vulkan precisaria registrar outputs reais, consultar a fila, confirmar qual dispositivo foi usado e medir uma geração de teste. O upstream publicou binários por plataforma: no release consultado em 25/10/2026 há `win-vulkan-x64` e `Linux-Ubuntu-24.04-x86_64-vulkan`, com SHA-256 exposto pela API do GitHub. Isso torna possível testar um pacote isolado e com versão/checksum fixos sem compilar o Vulkan SDK em cada PC, mas ainda não prova compatibilidade da GPU nem execução acelerada: o instalador teria que validar o dispositivo Vulkan real antes de reportar sucesso. Até existir esse adaptador, a tela deve apresentar Vulkan como possibilidade separada em avaliação — não como aceleração ComfyUI confirmada. O `--directml` existe no CLI do ComfyUI, mas sua presença não prova que cada workflow/nó funcione bem; também precisa de teste real no hardware alvo.

## Instalação permissiva quando o ComfyUI está ausente

A opção de primeira linha deve ser o **Comfy Desktop oficial**: seu instalador administra instalações isoladas, primeira execução pergunta se a pessoa quer Cloud ou Local e oferece uma instalação expressa local, desmarcada por padrão. O guia documenta Windows, macOS Apple Silicon e Linux, mas a compatibilidade do backend ainda depende do hardware escolhido ([guia de instalação](https://docs.comfy.org/installation/desktop/windows), [primeira execução](https://docs.comfy.org/installation/desktop/overview)). A primeira execução exige aceitar termos; a opção opcional de telemetria anônima vem marcada por padrão, então a Lia Forge deve deixar essa escolha visível ao usuário, nunca automatizá-la. A Lia Forge pode detectar que falta ComfyUI, explicar espaço/licenças e abrir o instalador oficial; a instalação precisa de consentimento claro, seleção do local e cancelamento seguro. Depois deve descobrir a URL, aguardar a API e validar o backend antes de marcar o setup como pronto.

O projeto comunitário [ComfyUI-Easy-Install](https://github.com/Tavris1/ComfyUI-Easy-Install) é um candidato de “Easy Install”, mas o README atual o identifica como **Windows + NVIDIA** e administra versões de PyTorch/CUDA; ele não é um instalador universal para AMD/RX 580, macOS ou Linux. Portanto, não deve ser o único caminho nem ser escolhido para equipes com hardware misto. Pode aparecer como opção avançada, identificada como comunitária e restrita ao perfil compatível. Para a RX 580, a rota Vulkan via `stable-diffusion.cpp` é outra instalação/motor, não o modo AMD desse Easy Install.

O sistema não deve instalar drivers, alterar o driver existente, trocar pacotes globais, baixar modelos nem aceitar licenças silenciosamente. O fluxo precisa mostrar o plano, destino, tamanho aproximado e fonte; oferecer instalar, escolher outra rota ou pular; e manter acesso a setups existentes. `models: []` permanece correto até a equipe escolher pesos e licenças.

## Referências oficiais

- [ComfyUI — requisitos de sistema e hardware](https://docs.comfy.org/installation/system_requirements)
- [stable-diffusion.cpp — código e releases Vulkan por plataforma](https://github.com/leejet/stable-diffusion.cpp/releases)
- [ComfyUI-Easy-Install — instalador comunitário (Windows/NVIDIA)](https://github.com/Tavris1/ComfyUI-Easy-Install)
- [ComfyUI — instalação manual, incluindo AMD/ROCm](https://docs.comfy.org/installation/manual_install)
- [ComfyUI Portable Windows — pacote AMD/ROCm](https://docs.comfy.org/installation/comfyui_portable_windows)
- [ComfyUI — arquivos, pastas e tipos de modelo](https://docs.comfy.org/basic-concepts/models)
- [ComfyUI — formato de workflow API](https://docs.comfy.org/development/api-development/workflow-api-format)
- [ComfyUI — rotas HTTP e fila local](https://docs.comfy.org/development/comfyui-server/comms_routes)
- [Comfy MCP — conexão local first-party](https://docs.comfy.org/agent-tools/mcp#local-comfy-mcp-connection)
