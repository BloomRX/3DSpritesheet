# Contrato de agent handoff

A Lia Forge separa o **brief do asset**, a **orquestração** e os **adapters de ferramentas**. No desktop, o usuário pode exportar o brief, produzir em ferramentas próprias e registrar outputs reais sem agente. Se escolher delegar, a UI/MCP exporta a tarefa; o game agent (Claude Code, Codex, OpenCode ou outro) coordena subagents e ferramentas no ambiente local do projeto.

## Entrada

O agente recebe um JSON `sprite-task.json` de acordo com [`asset-task.schema.json`](./asset-task.schema.json), além de quaisquer imagens de referência anexadas/fornecidas pelo usuário. O arquivo contém:

- projeto, tipo/subtipo, nome e destino;
- brief e prompt visual;
- resolução-alvo por frame e nomes das animações;
- workflow e contrato sugerido de entrega;
- rota `3d_to_2d`, ponto de entrada e lista de artefatos existentes;
- restrições de câmera, transparência, pivô e integridade dos arquivos.

O browser não deve tentar chamar providers diretamente. Referências do usuário são dados de projeto: o runner precisa receber os arquivos locais, não só o nome informado no JSON. Uma referência de imagem anexada no browser pode precisar de download explícito para o workspace.

## Retomar em uma etapa posterior

Task spec v2 usa `asset.startStageIndex` (zero-based) para indicar a primeira etapa desta execução e `asset.existingInputs[]` para indicar arquivos existentes (`path`, relativo à raiz do projeto, e `stageIndex`, etapa que produziu o arquivo). O runner deve validar que cada path existe, é legível e permanece dentro do projeto antes de usar. Caminhos inválidos bloqueiam a preparação do handoff MCP.

As etapas anteriores ao ponto de entrada aparecem com `execution: "skip"`. Isso significa **fora do escopo desta tarefa**, não “concluída”; não regenere, não reescreva e não atualize como completas. Quando um novo estágio for concluído, só então registre outputs reais e existentes com `spriteforge_update_stage`. Ao verificar dependências, o MCP exige conclusão apenas das etapas desde o ponto de entrada (além de exigir outputs reais da etapa a marcar).

Pontos de entrada 3D → 2D atuais: prompt/brief; brief pronto; conceito/vistas/poses 2D; modelo 3D; modelo rigado com animações. A ferramenta ainda não executa Code → 2D, Manequim → 2D ou produção de ambientes; isso está listado em [`usage-workflows.md`](./usage-workflows.md).

## Delegação recomendada

O agente principal atua como orquestrador, verifica dependências entre as etapas e reporta cada artefato. Quando o agente suporta subagents, delegar tarefas delimitadas:

1. **concept-artist** — interpreta brief e referências; prepara prompt/folha de vistas (frente, 3/4, perfil, costas) e registra decisões de design.
2. **3d-artist** — cria/limpa o mesh, respeita silhueta e proporção, prepara a exportação e documenta a ferramenta usada.
3. **technical-animator** — apenas personagens: cria rig humanoide, retargeta os clips solicitados e valida escala/nomes. Para item, este passo vira **prop-motion** opcional, nunca rig humanoide automático.
4. **sprite-renderer** — abre o asset rigado no ambiente de render, fixa câmera/iluminação/pivô, gera PNGs/atlas e JSON de frames.
5. **qa-reviewer** — confirma que cada caminho existe, alpha e padding estão corretos, animações não cortam o canvas e a escala não varia.

Se um provider, software 3D ou CLI não estiver instalado/configurado, o subagent deve parar na fronteira daquela etapa, deixar prompts/arquivos intermediários úteis e retornar o bloqueio. Não simular artefatos finais.

## Estrutura de saída sugerida

```text
<outputPath>/
├── README.md                 # ferramentas, versão, comandos e limitações
├── brief.md                  # decisões e parâmetros reproduzíveis
├── references/               # concept sheet e vistas ortográficas
├── 3d/
│   ├── source.blend          # quando Blender for usado
│   ├── model.glb
│   └── model.fbx             # opcional/necessário para a ferramenta de rig
├── rig/                      # personagens; pivô/encaixe para props
├── animations/               # um arquivo por clip, com nomes estáveis
└── sprites/
    ├── idle.png              # ou uma spritesheet por animação
    ├── atlas.png
    └── atlas.json            # frames, rect, pivot, fps, direção e nome do clip
```

A estrutura exata pode variar por engine, desde que o `README.md` do asset explique as equivalências e o import funcione no jogo.

## Regras de qualidade

- Câmera ortográfica e parâmetros fixos entre vistas e frames; sem cenário no PNG final.
- Personagem: pivô no chão/pés; nomear ações com os valores de `asset.animations`.
- Item: manter ponto de encaixe/pivô consistente; exportar rotação/brilho/recoil somente se pedido.
- Entregar arquivos fonte e descrever transformações; não sobrescrever um asset existente sem confirmar.
- Fazer validação visual da primeira, central e última pose de cada animação.
- Relatar honestamente providers, chamadas, arquivos e limitações. Um status `ready` só pode ser marcado após os arquivos existirem e passarem QA.

## Próxima integração

Um runner local/servidor poderá consumir o JSON, criar um diretório de job, resolver referências locais e invocar providers por interfaces (ex.: `generateViews`, `createModel`, `autoRig`, `renderSprites`). Adaptadores para APIs devem ser idempotentes e produzir logs/IDs de provider. Credenciais ficam fora do frontend, em variáveis de ambiente ou no gerenciador de segredos do runner.
