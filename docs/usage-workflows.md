# Fluxos de uso da Lia Forge

Este documento descreve o **fluxo de produção de assets**, separado do setup de GPU, ComfyUI, drivers ou provedores. O setup prepara adapters; ele não deve definir nem limitar por onde o usuário entra no trabalho.

## Princípio central: retomar, não refazer

Um asset é descrito por brief/referências, tipo, rota, ponto de entrada, artefatos existentes, etapas ainda necessárias e saídas esperadas. O usuário pode começar do zero ou retomar de um artefato intermediário. Etapas anteriores ao ponto de entrada ficam **fora desta tarefa**: não são refeitas nem contadas como outputs concluídos.

O fluxo distingue estes estados:

- **Entrada existente:** arquivo informado pelo usuário; deve ser validado antes de ser usado.
- **Pendente / em andamento / bloqueado:** trabalho da tarefa atual.
- **Concluído:** somente depois de outputs reais existirem e serem verificados no workspace.
- **Ignorado neste handoff:** etapa anterior ao ponto de entrada; não equivale a “concluída”.

Não mostrar uma barra de progresso fictícia, simular geração ou promover uma prévia ilustrativa a output final.

## Visão-alvo: configurar, executar e receber o resultado

Este é o objetivo do produto, ainda não a capacidade end-to-end da versão atual. Já existem fatias explícitas para gerar um PNG de conceito no ComfyUI usando checkpoint instalado escolhido pelo usuário e renderizar spritesheet + metadados no Blender a partir de um modelo existente. A pessoa configura o asset e inicia cada adapter; a cadeia completa — gerar modelo 3D, rig/animações e seguir até 2D sem condução entre etapas — continua pendente. A visão permanece: iniciar explicitamente o trabalho e então deixar a Lia Forge orquestrar ferramentas, validar saídas reais e entregar arquivos, sem exigir agente externo.

A execução automática começa somente depois do comando explícito da pessoa. Detectar ferramentas não significa instalá-las: instalações de apps/runtimes, drivers e downloads/aceite de modelos ou pesos exigem autorização e escolhas informadas. A Lia Forge não presume GPU, modelo ou licença. Se faltar uma dependência, uma escolha ou uma validação, deve pausar naquela decisão, explicar o bloqueio e permitir continuar, trocar a rota ou cancelar — nunca inventar outputs nem marcar uma etapa como concluída sem verificá-los.

Para chegar a esse objetivo, cada etapa precisa de um adapter executável (por exemplo, geração de conceitos via ComfyUI, construção/rig/render via Blender, composição 2D via ferramenta adequada), contratos de entrada/saída e uma fila de tarefas com progresso, logs, cancelamento e retomada. A interface atual de abrir aplicativos e registrar outputs é um fallback/manual, não o produto final pretendido.

## Agente é opcional: fluxo manual

A pessoa pode usar o Asset Studio sem conectar Claude Code, Codex, OpenCode ou qualquer outro agente. No desktop, cada etapa pode abrir uma ferramenta instalada diretamente da interface da Lia Forge (Blender detectado, ComfyUI local se estiver ativo ou um aplicativo escolhido pelo usuário), usando a pasta da etapa como diretório de trabalho. O usuário cria os arquivos na interface do próprio aplicativo e depois os registra na Lia Forge:

- Brief: exporta `brief.md` com os campos escritos pelo usuário; pergunta antes de substituir um arquivo diferente.
- Referências: registra imagens reais.
- Modelo 3D: registra arquivos de cena/modelo como `.blend`, `.glb`, `.gltf`, `.fbx`, `.obj` ou `.stl`.
- Rig/animação ou movimento: registra arquivos compatíveis; a etapa de movimento de item pode ser pulada explicitamente por ser opcional.
- Spritesheet: exige PNG e JSON de metadados.

O registro manual só aceita arquivos existentes, não vazios, dentro da pasta do asset e com extensões esperadas. Isso confirma presença/formato básico, não a qualidade visual, dimensões, alpha, integridade do rig ou correção dos metadados; a revisão continua sendo do usuário. A Lia Forge não instala as ferramentas: se um aplicativo não for detectado, o usuário pode escolher um executável já instalado. Handoff/MCP ficam disponíveis como alternativa de delegação, nunca como pré-requisito.

Duas ações automáticas adicionais estão disponíveis no desktop: em **Referências**, selecionar um checkpoint já instalado e gerar uma imagem de conceito pelo ComfyUI (sem baixar pesos); em **Spritesheet**, renderizar no Blender a partir de um modelo 3D existente dentro do workspace. O ComfyUI salva um PNG de referência após validar chunks, CRCs e cabeçalho/dados/encerramento. O Blender exige PNG RGBA íntegro e confere dimensões, grade, retângulos, nomes, pivôs e durações no JSON. Ambas exigem ação explícita; progresso bloqueado/falha não conclui a etapa. Essas validações estruturais não confirmam a qualidade visual.

## Rota inicial disponível: 3D → 2D

### Personagem

1. **Direção de arte** — prompt/brief e imagem de referência opcional.
2. **Referências** — vistas e/ou poses consistentes.
3. **Modelo 3D** — modelo game-ready.
4. **Rig & animação** — rig, retarget e clips pedidos.
5. **Spritesheet 2D** — render ortográfico, atlas e metadados.

Pontos de entrada planejados/disponíveis na tarefa v2:

- Só ideia, prompt e referências → começar na direção de arte.
- Brief já definido → começar nas referências.
- Conceito, vistas ou poses 2D existentes → começar no modelo 3D.
- Modelo 3D existente → começar em rig/animação.
- Modelo rigado e animações existentes → começar no render do spritesheet; o botão Blender já renderiza a partir de modelo 3D registrado, desde que o asset tenha animações informadas e o arquivo contenha ações compatíveis.

O handoff recebe caminhos de artefatos relativos à raiz do projeto. A tarefa manda verificar cada arquivo e parar se estiver ausente, ilegível ou incompatível. Esses arquivos não são copiados nem alterados automaticamente. Imagem anexada pelo browser pode exigir download explícito para o workspace antes de um agente externo acessá-la.

### Itens, armas e ferramentas

Usam a rota 3D → 2D e aceitam os mesmos pontos de retomada aplicáveis. O movimento/variação de item é opcional e usa pivô de encaixe; não aplicar rig humanoide automaticamente.

## Rotas adicionais previstas

Estas rotas fazem parte do desenho do produto, mas **ainda não são executadas nem selecionáveis no app atual**.

### Code → 2D

Rota alternativa para produzir arte por código, sem obrigar um passo 3D. Idealmente aceita brief/ref opcional, inspeção do código-fonte, preview determinístico, iteração por frames/variações e export de PNG/atlas acompanhado de fonte editável. O handoff precisa declarar runtime, dependências e comandos de reprodução; não afirmar que a imagem foi gerada sem arquivo real.

### Manequim → 2D

Usa um spritesheet/seqüência de poses de um manequim (por exemplo, animação exportada de um rig compatível com Mixamo) como guia de pose do personagem-alvo. A entrada deve preservar dimensões, ordem dos frames, pivô e câmera; o handoff precisa manter pose/alinhamento enquanto substitui o manequim pelo design escolhido, validar a consistência entre frames e exportar atlas/metadados. Compatibilidade de formato e licença do material de origem devem ser verificadas; nenhum rig/modelo de terceiros deve ser redistribuído sem autorização.

### Cenários e ambientes

Devem ser um tipo de asset próprio, não um personagem/item disfarçado. Oferecer ao menos dois contratos de saída:

- **Estático:** uma imagem final e fontes editáveis, com dimensões/crop definidos.
- **Camadas/profundidade:** imagem de fundo separada em foreground/midground/background e/ou depth map, com ordem, escala e parâmetros de parallax documentados.

A origem poderá ser prompt/referência, 3D, código ou materiais existentes. A rota precisa permitir retomar a partir de uma imagem, cena 3D ou camadas já prontas.

## Próximas mudanças de produto

1. Dar suporte às rotas Code → 2D e Manequim → 2D no modelo de tarefas e na seleção de fluxo.
2. Adicionar ambiente/cenário como tipo de asset com saídas estáticas ou em camadas/profundidade.
3. Permitir escolher o ponto de retomada diretamente no workflow e importar/selecionar arquivos com validação, em vez de depender apenas de digitar caminhos.
4. Integrar providers/adapters por etapa, mantendo geração fora do browser e sem baixar pesos ou instalar ferramentas sem consentimento explícito.
5. Vincular o estado de conclusão a verificações de arquivos, dimensões, alpha, atlas, poses e metadados apropriadas a cada rota.

## Estado atual da implementação

A UI e o MCP mantêm handoff opcional para personagem/item, ponto de entrada e artefatos existentes. No desktop, além do registro manual, o ComfyUI pode gerar um PNG de referência após checkpoint instalado ser escolhido e o Blender pode renderizar spritesheet + JSON de um modelo 3D registrado; as execuções têm estados/progresso persistidos e validação estrutural dos outputs. Não há geração prompt → 3D, rigging, criação de animações nem orquestração automática de todas as etapas. Code → 2D, Manequim → 2D e ambientes continuam planejados.
