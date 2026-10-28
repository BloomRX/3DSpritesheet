# Glossário da marca Lia — uma palavra, um significado

Documento curto e chato de propósito. Existe porque seis palavras deste projeto têm dois
ou três sentidos, e **nos três casos em que isso dá problema, o problema é silencioso**:
ninguém recebe erro, a coisa só é construída no lugar errado.

Vale para humanos e para sessões de IA. Em caso de dúvida, é este arquivo que manda.

---

## 1. "Modelo" — três coisas diferentes

| Quando eu digo | Quero dizer | Onde vive |
|---|---|---|
| **modelo de IA** / peso | o arquivo de vários GB que faz a inferência (Qwen, XTTS, Live2D) | `%LOCALAPPDATA%\Lia\Modelos\`, compartilhado entre os apps |
| **modelo de nuvem** / tier | o nome do que se pede ao provedor (`sonnet`, `haiku`, `fable`) | é texto numa configuração, não ocupa disco |
| **arquivo pronto** / template | um `CLAUDE.md` em branco pra copiar e preencher | pasta `arquivos-prontos/` do kit, vai pro **repositório** |

> O terceiro **chamava-se `modelos/`** e foi renomeado justamente por causa desta tabela.
> Se encontrar `modelos/` em algum texto antigo falando de `CLAUDE.md`, é `arquivos-prontos/`.

**Regra:** a palavra "Modelos" com M maiúsculo, como nome de pasta, significa **sempre**
peso de IA. Nenhum outro uso.

---

## 2. "Runtime" — duas coisas, e essa confusão é cara

| Termo | O que é | Exemplo |
|---|---|---|
| **runtime de agente** (`Agent Runtime`) | o programa que recebe uma tarefa e mexe no código | Claude Code, Codex, OpenCode |
| **motor de inferência** | o programa que carrega um peso e gera tokens/áudio | llama.cpp, ONNX Runtime, AllTalk |

Por que importa: o Runtime Registry do Lia-Studio é sobre o **primeiro**. A pasta
`Lia\Modelos\` é sobre o **segundo**. Uma sessão que misturar os dois vai tentar guardar
o Claude Code dentro da pasta de modelos, ou fazer o Registry gerenciar download de peso.

**Regra:** escreva "runtime de agente" ou "motor de inferência". Nunca "runtime" sozinho.

---

## 3. "Memória" — duas, e elas não se encontram

| Termo | De quem é a memória | Onde |
|---|---|---|
| **Memórias** (da Lia) | o que a personagem lembra **do usuário**: conversas, fatos, preferências | `%USERPROFILE%\Lia\Waifu\Memorias\` — dado do usuário |
| **`memory-bank/`** | o que a sessão de IA lembra **do código**: onde parou, padrões, decisões | dentro do repositório, versionado no git |

Nunca misture. O `memory-bank/` vai pro GitHub e é público; as Memórias da Lia são
privadas e **jamais** entram em repositório. Já existe `.gitignore` pra isso — confira
antes do primeiro commit.

---

## 4. "Sessão" — três sentidos

| Termo | O que é |
|---|---|
| **sessão de desenvolvimento** | o agente que trabalha no repositório **só por git**, sem acesso à máquina do dono |
| **sessão do runtime** (`session_id`) | uma invocação do Claude Code que pode ser retomada com `--resume` |
| **Session** (maiúsculo) | a entidade do `AI-AGENTS-ARCHITECTURE.md` do Lia-Studio |

A que mais aparece nos guias é a primeira. Quando um documento diz *"a sessão faz X"*, é
o agente que edita por git — e por isso toda tarefa de setup vem partida em duas: **o que
a sessão faz por git** × **o que o dono faz na máquina**.

---

## 5. "Skill" — mesmo conteúdo, três lugares

| Caminho | O que é |
|---|---|
| `.agents/skills/` | onde as skills **moram** no repositório. É o que vai pro git |
| `.claude/skills/` | onde o Claude Code **procura**. Um junction aponta pro de cima |
| `%USERPROFILE%\Lia\Studio\Skills\` | skills que o **usuário final** escreveu, fora do repositório |

Os dois primeiros são o mesmo conteúdo visto por duas portas — não copie, aponte.
⚠ `.claude/` no `.gitignore` **antes** de criar o junction, senão o Git commita tudo em
dobro.

---

## 6. "Local" — cuidado com esta

| Termo | O que é |
|---|---|
| **modelo local** | roda no PC do usuário, ocupa disco |
| **servidor dele** (Colab, LAN, túnel) | roda fora, mas é dele. **Não ocupa disco**, e o endereço expira |
| **`localhost`** | o endereço `127.0.0.1`. Nunca fixo no código — é sempre campo editável |
| **`CLAUDE.local.md`** | arquivo de regras pessoais, fora do git |

Um modelo no Colab **não** é modelo local — é um endereço digitado, modo 2 da seção 4.4.1.
Tratar os dois igual é o erro que faz o app tentar criar pasta pra algo que não tem arquivo.

---

## 7. "Projeto" — e o nome do repositório engana

| Termo | O que é |
|---|---|
| **`Lia-Project`** (repositório) | é a **Waifu**. O nome é histórico e confunde todo mundo |
| **projeto** (no Studio) | um jogo que o usuário está fazendo |
| **projeto** (genérico) | qualquer um dos repositórios da marca |

Mapa de nomes, porque repositório e pasta **não** se chamam igual:

| Repositório | Pasta do usuário | Apelido no texto |
|---|---|---|
| `Lia-Project` | `%USERPROFILE%\Lia\Waifu\` | a Waifu |
| `Lia-Studio` | `%USERPROFILE%\Lia\Studio\` | o Studio |
| `Lia-Go` | celular — não tem pasta | o Lia Go |

---

## 8. Outras duplas menores

- **`AGENTS.md`** (arquivo de instruções) × **`.claude/agents/`** (os quatro ajudantes:
  `explore`, `reviewer`, `visual-qa`, `test-runner`). Nomes parecidos, coisas sem relação.
- **`config\`** (`%APPDATA%\Lia\<App>\config\`, técnico, pequeno) × **`Perfis\`**
  (`%USERPROFILE%\Lia\Waifu\Perfis\`, o que o usuário montou no launcher e pode exportar).
  A segunda pasta **chamava-se `Configuracao\`** e foi renomeada por causa desta linha.
- **`LEIA-PRIMEIRO.md`** (índice do pacote) × **`LEIA-ME-SESSAO.md`** (instrução pra
  sessão, dentro de cada pasta de projeto) × **`LEIA-ME.txt`** (dentro de
  `%USERPROFILE%\Lia\`, escrito pro usuário final, 10 linhas, sem jargão).
