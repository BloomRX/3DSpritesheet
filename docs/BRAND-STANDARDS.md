# Padrão da marca e do ecossistema Lia

**Versão:** 1.0  
**Data:** 30/10/2026  
**Aplicação:** todos os produtos, ferramentas, laboratórios e projetos da marca Lia.

Este documento define a camada comum de identidade, linguagem, privacidade, autonomia e padronização. Ele **não substitui** a arquitetura, as regras de negócio nem o design system específico de cada produto. Em caso de conflito, preserve segurança e comportamento já aprovados; registre a divergência em vez de adaptar silenciosamente.

## 1. Identidade e nomes

- **Lia** é a marca e o ecossistema. Cada produto mantém nome próprio e proposta clara: Lia Waifu, Lia Studio, Lia Go, Lia Voice Studio, Lia Forge, Lia Model Lab e outros.
- Use o nome oficial do produto de forma consistente em README, títulos, interface, instaladores, relatórios e documentação.
- Não apresente um projeto de ferramenta, laboratório ou infraestrutura como se fosse a própria personagem Lia.
- A personagem, a marca, os ícones, logotipos, artes e assets proprietários não passam a ser MIT/Apache apenas porque o código do repositório usa essa licença. Declare a licença de cada categoria separadamente.

## 2. Princípios comuns de produto

1. **Autonomia:** cada produto deve permanecer utilizável no seu escopo sem exigir a instalação ou a execução de outro produto Lia. Integrações são opcionais, explícitas e revogáveis.
2. **Controle do usuário:** não instalar, baixar, enviar, gastar, publicar, sobrescrever ou apagar dados sem autorização apropriada e comunicação clara do efeito.
3. **Transparência:** diferencie funcionalidade implementada, planejada, experimental e não testada. Não simule disponibilidade, integração ou execução.
4. **Escolha de custo e hospedagem:** quando aplicável, diferencie execução local, servidor controlado pelo usuário e serviço remoto/pago. Informe limites, dependências e custos conhecidos; não prometa cotas ilimitadas nem esconda fallback pago.
5. **Privacidade por padrão:** colete o mínimo necessário, explique destinos e retenção, proteja segredos e não coloque dados pessoais, credenciais ou memórias privadas no Git.
6. **Ações externas:** uma conversa ou sugestão da IA não é autorização para executar uma ação externa. Permissões, validação e registro pertencem ao produto/runtime, não aos pesos de um modelo.

## 3. Linguagem e personalidade

- Português brasileiro é o idioma padrão dos produtos e da documentação dirigida ao usuário, salvo exigência explícita de internacionalização.
- A comunicação deve ser clara, acolhedora, respeitosa e tecnicamente honesta. Personalidade e humor não podem prejudicar compreensão, acessibilidade, segurança ou confiança.
- Em ferramentas internas e laboratórios, prefira linguagem direta e precisa; não force voz de personagem em relatórios técnicos.
- Não use rótulos que envergonhem o usuário nem esconda limitações em microcopy promocional.

## 4. Direção visual comum

Quando o projeto tiver interface visual, a família Lia pode usar superfícies escuras com acentos em rosa, magenta, vinho e roxo, complementados por branco ou lilás. Brilho, glow, ornamentos Sakura e presença da personagem devem ser moderados e servir à hierarquia da tela.

- Esta é uma **direção de família**, não uma paleta com valores hex obrigatórios nem um componente compartilhado.
- Cada produto pode ter personalidade visual própria, documentada no seu design system.
- Contraste, legibilidade, foco, navegação por teclado, estados textuais e tamanhos de toque têm prioridade sobre efeitos decorativos.
- Laboratórios, ferramentas CLI e documentação técnica não precisam imitar uma interface de consumidor.

## 5. Vocabulário sem ambiguidades

| Termo | Uso correto |
|---|---|
| **modelo-base** | arquitetura/checkpoint original usado como ponto de partida para treinamento ou inferência |
| **pesos/checkpoint** | parâmetros aprendidos de um modelo de IA; podem incluir pesos base, adapter ou modelo mesclado |
| **adapter** | parâmetros adicionais, por exemplo LoRA/QLoRA, associados a uma base específica |
| **modelo de avatar/3D** | asset visual/geométrico, como Live2D, VRM ou GLB; não é peso de LLM |
| **motor de inferência** | software que carrega pesos e executa geração/inferência |
| **runtime de agente** | software que recebe tarefas e coordena ferramentas/agentes, por exemplo Codex ou Claude Code |
| **memória da Lia** | informação persistente sobre o usuário ou interações; dado do usuário, fora dos pesos e fora do Git |
| **memory-bank** | documentação de continuidade do desenvolvimento dentro do repositório |
| **dataset** | conjunto versionado por manifesto, origem, finalidade, licença, versão e hash; pode conter dados sensíveis e exige governança |
| **skill** | procedimento reutilizável para um agente, documentado em `.agents/skills/<nome>/SKILL.md` |

Não use apenas “modelo”, “runtime” ou “memória” quando o contexto puder ser confundido.

## 6. Dados, modelos e licenças

- Separe licença de código, licença de modelo-base, licença de adapter/derivado, licença de dataset, licença de assets e direitos de marca/personagem.
- Antes de treinar, redistribuir ou vender pesos derivados, revise os termos da base, dos dados e das dependências na versão efetivamente usada.
- Registre origem, versão/revision, SHA-256, alterações, restrições comerciais, atribuição e obrigações de redistribuição.
- Dados sintéticos devem ser identificados como sintéticos e não podem ser apresentados como dados humanos.
- Benchmarks de avaliação devem permanecer isolados do treinamento; registre splits e controles contra contaminação.
- Arquivos de memória pessoal, transcrições privadas, prompts de usuários, tokens, chaves e outros segredos não entram em datasets nem em commits.

## 7. Documentação e evidência

Use estados explícitos e consistentes:

- **PLANEJADO:** proposta ainda não implementada.
- **IMPLEMENTADO / CODE-PRESENT:** existe código ou artefato, mas isso não prova execução.
- **AUTOMATED-PASS:** teste automatizado identificado passou.
- **RUNTIME-PASS:** comportamento foi exercitado no runtime e ambiente reais, com evidência.
- **NOT-TESTED:** não executado ou não validado.
- **EXPERIMENTAL:** resultado limitado, sujeito a mudança e sem promessa de produto estável.
- **BLOCKED:** depende de decisão, acesso, orçamento ou pré-requisito ainda não atendido.

Relatórios precisam registrar data, ambiente, versão e comando/procedimento. Não transforme plano em fato nem teste parcial em aprovação de release.

## 8. Agentes, instruções e skills

- `AGENTS.md` na raiz é a orientação transversal do repositório; arquivos de instruções em subpastas refinam o escopo local. Mantenha-o conciso e aponte para documentos detalhados.
- `.agents/skills/` é a localização versionada das skills do repositório, quando usadas. Não suponha que todo host descubra ou carregue skills automaticamente; instrua o agente a ler a skill pertinente quando a plataforma não oferecer descoberta nativa.
- `.claude/rules/` e agentes/configurações compartilhados só devem ser versionados deliberadamente. Ignore apenas arquivos locais conhecidos (por exemplo `.claude/settings.local.json`, worktrees e espelhos/junctions de skills); **não ignore a pasta `.claude/` inteira** se ela contiver regras compartilhadas.
- `CLAUDE.md` deve ser um adaptador específico do Claude quando necessário, não uma cópia duplicada que se desvie de `AGENTS.md`.
- Skills e subagentes são procedimentos/ajudantes; não alteram as permissões do processo principal nem autorizam operações pagas, uploads ou ações destrutivas.

## 9. Aplicação por tipo de projeto

- Aplicativos Windows, mobile e web complementam este padrão com regras de instalação, armazenamento, sincronização, acessibilidade e publicação específicas da plataforma.
- Ferramentas de desenvolvedor e serviços internos complementam este padrão com contratos de API, isolamento, logs, permissões e segurança.
- Laboratórios de IA complementam este padrão com model cards, dataset cards, manifests de experimentos, benchmarks, proveniência, custos de GPU e gates de release.
- Nenhum documento genérico deve forçar uma stack, um runtime, um caminho de dados ou um método de distribuição que não se aplique ao projeto.
