# Lia Forge — ideia do produto e lacunas atuais

**Revisão em:** 2026-10-27

**Objetivo:** comparar a intenção documentada com o que o código realmente entrega, sem tratar uma funcionalidade planejada como pronta.

## Visão-alvo confirmada pelo usuário

A ideia é **a pessoa configurar o que quer e receber o asset pronto**, não operar manualmente cada aplicativo. O fluxo-alvo é: preencher brief/prompt e referências; escolher tipo, saída e ponto de entrada (Prompt → 3D → 2D ou uma etapa posterior com artefatos que já existem); iniciar explicitamente a tarefa; então a própria Lia Forge coordena os adapters e ferramentas necessárias — ComfyUI, Blender, Krita ou outros —, passa os resultados de uma etapa para a seguinte, acompanha e valida o trabalho e entrega os arquivos finais no workspace. Depois de iniciar, a pessoa deve poder aguardar o resultado e só ser chamada para decisões, consentimentos ou bloqueios reais. Agentes externos continuam opcionais.

“Executar automaticamente” aqui significa orquestrar o pipeline **após uma ação explícita de iniciar**; não significa instalar software, drivers ou modelos, baixar pesos ou aceitar licenças sem autorização. A Lia Forge deve detectar o que existe, explicar dependências/opções e pedir consentimento quando necessário. Não deve presumir GPU/VRAM ou escolher pesos pelo usuário.

Essa visão é maior que o estado atual. Já há duas fatias automáticas sem agente — geração de PNG de conceito pelo ComfyUI com escolha explícita de checkpoint instalado e render de spritesheet + metadados no Blender a partir de modelo existente — mas elas são ações isoladas, não a execução automática de ponta a ponta. Geração prompt → 3D, rigging/animação e as rotas Code → 2D, Manequim → 2D e ambientes continuam pendentes.

## Busca por instruções de agentes e skills

- Não encontrei `AGENTS.md`, `SKILL.md`, diretório `skills/`, `.agents/` ou `.claude/` no repositório nem no workspace pesquisado.
- `docs/agent-workflow.md` existe, mas é o contrato que a Lia Forge entrega a agentes externos para um handoff; **não** é um guia de contribuição/instruções para agentes que editam este repositório.
- Não encontrei skills reutilizáveis de criação 3D, arte de jogo, ComfyUI ou validação de spritesheet. Não importei skills de terceiros sem revisar origem, licença e comportamento. Se forem adicionadas depois, candidatos úteis seriam: briefing/design de asset, Blender modelagem→rig→render, workflows ComfyUI e validação de spritesheets/metadados.

## Comparação: intenção × implementação

| Área | Intenção documentada | O que existe no código | Situação |
|---|---|---|---|
| Janela desktop e workspace local | Usar a ferramenta sem depender de abas ou de um agente; manter dados no workspace do projeto. | Launcher Python + Electron, armazenamento local `.spriteforge/assets.json`, janela desktop e proteções de navegação/fechamento. O empacotamento Windows está configurado, mas o README confirma que nenhum instalador `.exe` foi produzido/validado. | **Parcialmente pronto** — fonte/launcher existem; ainda falta uma distribuição de usuário final validada. |
| Pipeline de personagem e item | Brief → referências → modelo → rig/movimento → spritesheet; retomar sem refazer etapas anteriores. | UI/estado/handoff/MCP; ComfyUI gera PNG de conceito após clique e escolha de checkpoint instalado; Blender rende PNG + JSON a partir de modelo registrado. | **Parcial** — dois adapters isolados existem; geração de modelo, rig/animação e execução das etapas intermediárias continuam externas/manuais/delegadas. |
| Uso sem agente | Depois de configurar e iniciar, aguardar enquanto a Lia Forge coordena as ferramentas e entrega o resultado; não operar cada app etapa por etapa. | A UI pode abrir ferramentas, gerar referência no ComfyUI e renderizar com Blender a partir de 3D existente; ações são explícitas por etapa. | **Grande lacuna** — a pessoa ainda precisa fornecer modelo/rig/animações e conduzir as outras etapas; não há entrega prompt → 3D → 2D autônoma. |
| Orquestração do pipeline | Executar as etapas necessárias, ligar outputs a inputs, mostrar progresso, recuperar de erros e entregar um resultado verificável. | Runner serial de uma execução, eventos de progresso/estado e persistência; dois adapters de uma etapa, validação por adapter. | **Parcial** — sem DAG do pipeline completo, retomada automática após reinício, retry UI ou fila de produção. |
| Criação/geração dentro da Lia Forge | Produzir imagens/modelos/rig/spritesheet por adapters locais escolhidos para cada etapa, sem exigir agente externo. | ComfyUI gera concept PNG; Blender renderiza spritesheet de modelo existente, com turntable para item e frames de ações já existentes para personagem. | **Parcial** — não cria modelos 3D, rigs nem animações; não há edição 2D ou cadeia completa. |
| ComfyUI sem agente | Usar geração local com controle do usuário, iniciada pela Lia Forge depois de uma ação explícita. | Consulta status; botão escolhe workflow de personagem/item, verifica checkpoint instalado, envia prompt, acompanha history e salva PNG validado na etapa de referências. | **Parcial** — sem download/instalação de pesos, uso de referência visual como condicionamento ou validação de qualidade/consistência; MCP de agentes não é necessário. |
| Retomar de arquivos existentes | Aceitar prompt, imagens, poses, modelo ou rig e começar na etapa adequada. | A UI oferece ponto de entrada e caminhos relativos em texto; MCP/desktop validam existência e contenção no projeto ao preparar ou iniciar a etapa. | **Parcial** — não há ainda um seletor/importador de arquivos no fluxo; validação é básica e não confirma se o modelo/rig é realmente utilizável. |
| Veracidade e validação de outputs | Só concluir com artefatos reais, sem simular geração. | ComfyUI: PNG real salvo, chunks/CRCs/IHDR/IDAT/IEND conferidos. Blender: PNG RGBA de 8 bits + JSON reais, dimensões do atlas versus metadados, grade, retângulos, pivôs e durações conferidos antes de concluir. | **Parcialmente implementado** — exige canal alpha no cabeçalho PNG, mas não confirma pixels transparentes; também não valida qualidade visual, pivô, consistência de vistas, rig ou compatibilidade semântica do modelo. |
| Ambientes e cenários | Tipo próprio com saída estática ou camadas/depth/parallax. | O formulário de asset aceita apenas `character` e `item`; “prop/cenário” é uma categoria de item. Schema/MCP e pastas manuais também só conhecem esses dois tipos. | **Ausente** — não existe contrato para fundo estático, camadas, depth map ou parallax. |
| Rotas Code → 2D e Manequim → 2D | Produzir 2D sem obrigar modelagem 3D, ou usar poses de manequim como guia. | `docs/usage-workflows.md` e `docs/agent-workflow.md` explicitamente dizem que são rotas futuras. UI/schema/MCP aceitam só `3d_to_2d`. | **Ausente**. |
| Hardware e instalação de IA | Detectar hardware/runtime, recomendar uma rota compatível e pedir consentimento antes de instalar/baixar. | `doctor` detecta runtimes e consulta dispositivos reportados por uma instância ComfyUI já ativa; não faz inventário confiável de GPU nem compatibilidade CUDA/ROCm/Vulkan. Modelo configurado fica vazio; o downloader CLI exige HTTPS, checksum e aceite de licença. | **Parcial** — boas proteções para pesos; falta o onboarding hardware-aware e a instalação opcional/local de um backend. |
| Delegação a agentes | Oferecer handoff para Claude Code, Codex, OpenCode etc. sem torná-los obrigatórios. | UI/MCP exportam tarefas, restrições, pontos de entrada, insumos e validação de outputs; integração de configuração MCP opcional. | **Parcialmente pronto** — prepara e acompanha o contrato; quem executa as ferramentas é o agente/ambiente externo. |

## Lacunas prioritárias

1. **Expandir o runner de workflows**: ligar adapters em um plano retomável, persistir estado após reinício, adicionar retry/cancelamento acessíveis na UI e evoluir a fila serial para produção coordenada. O runner e as primeiras etapas existem, mas não são uma cadeia completa.
2. **Completar a fatia vertical sem agente**: hoje ComfyUI produz um concept PNG e Blender renderiza 3D existente para PNG + JSON; ainda falta gerar ou aceitar o modelo/rig/animações de forma integrada, passar outputs automaticamente e entregar uma prévia/asset final da cadeia Prompt → 3D → 2D.
3. **Criar adapters executáveis para os aplicativos** (começando pelos já detectados): integração por API/CLI/script, transferência do contexto e dos arquivos, coleta de outputs e diagnóstico de falha. Abrir um `.exe` com uma pasta como `cwd` não substitui isso.
4. **Manter consentimento e setup seguros**: detectar hardware/runtime sem adivinhar; mostrar plano, dependências, fonte/licença e tamanho; pedir autorização para instalar apps/drivers ou baixar pesos; validar backend antes da produção. A execução do workflow só começa após a pessoa apertar “Iniciar”.
5. **Adicionar ambientes como tipo de primeira classe.** Definir formulário, adapters, pastas, retomada e validação para ambiente estático e para camadas/depth/parallax; prop não substitui cenário.
6. **Implementar Code → 2D e Manequim → 2D** no modelo de tarefas, seleção de fluxo, schema/MCP e contratos de saída.
7. **Substituir caminhos digitados por seleção/importação guiada.** Validar extensão, localização e legibilidade no momento da seleção; preservar os insumos existentes sem forçar refazer brief/referência/modelo/rig.
8. **Aumentar a validação por tipo de saída.** PNG: dimensões, alpha e atlas; JSON: schema, frames, nomes e pivôs; 3D: abrir/validar formato e escala; depois, preview/revisão antes de marcar pronto.
9. **Completar distribuição e teste ponta a ponta.** Produzir/testar instalador Windows e fluxos equivalentes em outras plataformas; validar a cadeia numa máquina real com ferramentas/runtime escolhidos.

## Arquivos usados como evidência

- `README.md` — posicionamento, launchers, ComfyUI, pesos, limites e funcionalidades atuais.
- `docs/usage-workflows.md` — princípio de retomada, fluxo manual, rotas disponíveis e rotas explicitamente futuras.
- `docs/agent-workflow.md`, `docs/asset-task.schema.json`, `docs/mcp.md` — contrato de handoff, schema e ferramentas MCP.
- `docs/comfyui.md`, `scripts/comfyui-client.mjs`, `workflows/comfyui/` — consulta de status, geração explícita de concept PNG com checkpoint instalado e requisitos planejados de hardware/setup.
- `src/App.jsx`, `electron/main.cjs`, `electron/manual-artifacts.cjs`, `electron/external-tools.cjs` — UI real, abertura de ferramentas, IPC e validação manual.
- `scripts/spriteforge_launcher.py`, `package.json` — bootstrap, detecção, modelos e empacotamento.
