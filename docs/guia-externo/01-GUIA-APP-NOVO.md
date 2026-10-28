# Guia — criar um app ou plugin novo da marca Lia

Vale para a próxima ferramenta: Lia Go, Lia GPS, um plugin da Waifu, o que vier.
Escrito em 18/10/2026.

Leia junto com o **`00-PADRAO-DA-MARCA.md`**, que tem pastas, instalação e descoberta.
Se o app for **mobile ou web**, leia também o **`04-MOBILE-E-WEB.md`** — boa parte do
padrão de pastas **não se aplica** lá.

---

# 1. O que faz um app ser "da marca Lia"

Não é o logo. São sete regras. Se o app cumpre, é da marca; se não cumpre, é outra coisa
com o mesmo nome.

| # | Regra | Por quê |
|---|---|---|
| 1 | **Funciona sozinho.** Sem a Waifu, sem o Studio, sem internet obrigatória, sem conta. | É a sua regra do `LIA-PROJECT-INTEGRATION.md`, generalizada: *"pode enriquecer; nunca deve ser necessário"*. |
| 2 | **Baixou, abriu, funciona.** Só pede ao usuário o que só ele pode dar — uma chave, uma pasta. | É a sua filosofia declarada. Tudo mais é falha de instalação. |
| 3 | **O trabalho dele é dele.** Fica numa pasta visível, achável, copiável, deletável. Nunca refém do app. | Confiança. Um app que sequestra os dados não é usado duas vezes. |
| 4 | **Não esconde custo nem risco.** Antes de uma ação que pode gastar, enviar dado ou ser irreversível, avisa. | `AI-PROVIDERS-FREE-FIRST.md` §6, que vale pra marca inteira. |
| 5 | **Não mente sobre o que fez.** Simulado é rotulado simulado. Não executado é "não executado". | É o ativo mais valioso do Lia Studio. Perder isso custa mais do que qualquer recurso ganho. |
| 6 | **Neutro de fornecedor.** Nenhum provedor, modelo ou runtime obrigatório no código. | `AI-PROVIDERS-FREE-FIRST.md` §3. Também protege de um fornecedor sumir. |
| 7 | **A conexão com a Lia é opcional e revogável.** Ver seção 6. | Privacidade e sobrevivência: a ponte cai, o app continua. |

---

# 2. Dia 0 — o repositório

## 2.1 Arquivos que já nascem com o projeto

```
<App>/
├── LICENSE                     MIT no código próprio
├── THIRD_PARTY_NOTICES.md      nome, versão, licença, finalidade, redistribuição
├── README.md                   ver 2.2
├── CLAUDE.md                   UMA PÁGINA. Ver 2.3
├── AGENTS.md                   se quiser compatibilidade com Codex/Cursor. Ver 2.3
├── .gitignore                  precisa conter  .claude/  desde o primeiro commit
├── .agents/skills/             skills do projeto, fonte única
├── memory-bank/                estado: onde paramos, padrões, decisões
└── docs/
```

**O `.gitignore` com `.claude/` desde o primeiro commit.** Nos dois projetos atuais isso
faltou, e o Git no Windows enxerga junction como pasta normal — ele commitaria tudo
duplicado. É mais fácil nascer certo do que consertar depois.

## 2.2 O README honesto

O README do Lia Studio é o melhor que eu li nos seus repositórios e deve virar o molde.
Ele separa, com títulos próprios:

- o que **está** implementado e aceito;
- o que é **apenas simulado** ou não implementado;
- o que está **integrado mas não validado** na plataforma-alvo;
- o que cada aceite **não** significa.

Isso parece burocracia e não é: é o que impede uma sessão nova — ou você daqui a três
meses — de partir de premissa falsa. Mantenha em todo app novo.

## 2.3 `CLAUDE.md` de uma página, e por quê

O erro mais caro do Lia-Project foi deixar o arquivo de instrução crescer até 58 KB. Ele é
recarregado **em toda mensagem**: ~16 mil tokens por mensagem, pra sempre.

No app novo, nasce certo:

| Entra no `CLAUDE.md` | Vira skill em `.agents/skills/` | Vai pro `memory-bank/` |
|---|---|---|
| o que vale em **toda** mensagem | procedimento de **um assunto** | estado de **agora** |
| 1 página, no máximo 2 | ~100 tokens no índice, corpo sob demanda | lido quando precisa |
| regras duras, fronteiras, "não faça" | "como fazer X nesta stack" | onde paramos, o que falhou |

Se o `CLAUDE.md` passar de duas páginas, alguma coisa ali é skill.

**Detalhe de precedência que morde:** desde a v2.1.277 o Claude Code lê `AGENTS.md`
sozinho — **mas só se não houver nenhum `CLAUDE.md` na pasta aberta nem acima dela**.
Tendo os dois, ele lê o `CLAUDE.md` e ignora o `AGENTS.md`.

**Não resolva isso com `@AGENTS.md` na primeira linha.** Esse import só expande no
`CLAUDE.md` da pasta onde a sessão foi aberta. Quando o arquivo é carregado por estar
*acima* da pasta aberta, o texto dele entra e **os imports são pulados em silêncio** —
sem erro e sem aviso. Em projeto com subpastas, isso perde as regras inteiras.

O modelo do kit resolve pelo caminho chato que funciona: **o mesmo texto literal nos dois
arquivos.** Duplicar incomoda, mas um arquivo de duas páginas é barato de manter em par, e
é a única forma de o Codex e o Cursor receberem as regras de verdade.

## 2.4 Regra que só aparece quando precisa

Um `CLAUDE.md` de uma página dá conta do que vale sempre. Para o detalhe de **uma área
só** existe um mecanismo melhor que skill: `.claude/rules/`.

| onde | quando entra no contexto |
|---|---|
| `CLAUDE.md` | sempre, inteiro |
| `.claude/rules/x.md` **sem** `paths:` | sempre, igual ao `CLAUDE.md` |
| `.claude/rules/x.md` **com** `paths:` | **só quando o agente mexe num arquivo que casa** |

O kit traz um pronto: `rule-exemplo--interface.md`. Vai em `.claude/rules/`.

Por que isso e não uma skill: skill dispara por julgamento do agente — se a descrição for
vaga, ela nunca é chamada. Rule com `paths:` dispara por fato: tocou no arquivo, entrou.

**Três coisas que mordem:**

- **`.claude/rules/` precisa ir pro git.** O `.gitignore` do kit ignora `.claude/skills/`,
  `.claude/worktrees/` e `.claude/settings.local.json` — **não** `.claude/` inteiro. Se
  ignorar a pasta toda, as regras não chegam em mais ninguém.
- **YAML quebrado falha abrindo.** Se o bloco entre `---` não for YAML válido, o filtro é
  ignorado e a regra carrega **em tudo**. Glob que começa com `*` ou `{` precisa de aspas.
- **Fatiar em `@import` não economiza nada.** A documentação é literal: *"Splitting into
  @path imports helps organization but doesn't reduce context, since imported files load
  at launch."* Só `paths:` economiza.

Para conferir o que carregou: `/context` na sessão, seção **Memory files**.

## 2.5 Licença, desde o primeiro commit

- **Código próprio: MIT.** É o que os dois projetos já usam.
- **Marca separada.** Nome, personagem, logo e identidade visual **não** entram na MIT.
  O Lia Studio já tem essa separação escrita no `THIRD_PARTY_NOTICES.md` — copie.
- **Toda dependência entra na tabela** com nome, repositório, versão, licença, finalidade,
  se pode redistribuir e se exige atribuição. Preencher na hora de adicionar, não depois.
- **Apache-2.0 não é MIT.** Exige preservar o arquivo `NOTICE` e traz cláusula de patente.
  Compatível, mas a atribuição é obrigatória.
- **Biblioteca ≠ pesos de modelo.** O código pode ser livre e os pesos não. É a armadilha
  do XTTS-v2 que o seu `M1-CUSTOM-VOICE-LICENSING.md` já documenta corretamente.

---

# 3. A bancada — ligar o fluxo de agentes

## 3.1 A divisão que não pode faltar

As sessões de desenvolvimento **só editam por git**. Elas não têm a sua máquina e não
podem testar no Windows. Então toda tarefa de setup tem duas metades:

| Quem | O quê |
|---|---|
| a sessão, por git | arquivos, `.gitignore`, skills, `CLAUDE.md`, código |
| **você**, depois do `git pull` | junctions, variáveis de ambiente, reiniciar o Claude Code, rodar no Windows |

Se a tarefa não vier separada assim, a sessão vai dizer "pronto" com metade feito.

## 3.2 Os passos, em ordem

```
# 1) a sessão: .gitignore com  .claude/   (commit)
# 2) você, após o pull:
New-Item -ItemType Junction -Path ".claude\skills" -Target ".agents\skills"

# 3) você: instalar os 4 ajudantes no projeto
.\arruma-agentes.ps1 -Projeto

# 4) reiniciar o Claude Code  (skill só é descoberta na inicialização)
# 5) conferir:   /skills     /agents     /memory
```

Script `.ps1` baixado chega bloqueado pelo Windows. Antes de rodar:

```
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
Unblock-File .\arruma-agentes.ps1
```

## 3.3 Os quatro ajudantes, e o que ajustar por projeto

| Ajudante | O que faz | O que ajustar |
|---|---|---|
| `explore` | Haiku, só `Read/Grep/Glob`, devolve ≤20 linhas, **nunca cola código** | nada — use sempre antes de abrir arquivo na conversa principal |
| `reviewer` | roda `git diff`, devolve `[ALTO\|MEDIO\|BAIXO] arquivo:linha`, máx. 10 | nada |
| `test-runner` | roda o teste, **nunca conserta**, devolve `RESULTADO: N passaram, M falharam` | **o comando**, em `memory-bank/padroes.md` |
| `visual-qa` | só lê `captures/`, **recusa ler código**, responde `VEREDITO:` ou `NAO CONSIGO VER A IMAGEM` | de onde vem o print |

O princípio do `visual-qa` vale repetir: **agente de código é enviesado a favor do próprio
output.** Quem escreveu não pode ser quem aprova.

## 3.4 Permissões: trava, não pedido

Regra escrita em markdown o modelo pode ignorar sob pressão. Comando proibido vai em
`permissions` com `deny`.

Ordem: **deny → ask → allow**, e `deny` vence. Dois detalhes:

- **Subagente não exibe prompt.** Um `ask` dentro de subagente vira negação na prática.
  Para subagente use `deny` explícito.
- `tools` é lista de permissão (omitir `Write`/`Edit` já trava escrita).
  `Bash(npm run *)` é conceito de **permissions**, não de `tools`.

Mínimo sugerido em `deny`: `git reset --hard`, `git clean`, `git stash`, `git rebase`,
`git commit --amend`, `git push --force`.

## 3.5 Segredo

Chave de gateway e token vão em `.claude/settings.local.json`, **nunca** no
`settings.json` versionado. E `.claude/` inteiro no `.gitignore` — que é o mesmo passo
2.1, por um segundo motivo.

---

# 4. Pastas, instalação e descoberta

Está tudo no **`00-PADRAO-DA-MARCA.md`**. O que é obrigatório num app novo de desktop:

1. **Um módulo só resolve caminho** (`caminhos.py` ou equivalente), detectando se está
   empacotado ou rodando do fonte. Nenhum outro módulo monta caminho na mão.
2. **As pastas de dados são idênticas** rodando do repositório ou do `.exe`.
3. **Instalação por usuário**, sem administrador, em `%LOCALAPPDATA%\Programs\Lia\<App>`.
4. **Prefixo `Lia\` em todas as raízes**; trabalho do usuário em `%USERPROFILE%\Lia\<App>\`.
5. **Ler o bilhete** `%APPDATA%\Lia\lia.json` na instalação e propor a raiz já existente.
   Mesclar a própria entrada, nunca sobrescrever o arquivo inteiro.
6. **`--diagnostico`** imprimindo cada caminho, a fonte que decidiu e ✓/✗ de existência.

Se o app for mobile, nada de 1 a 6 se aplica do mesmo jeito. Ver `04-MOBILE-E-WEB.md`.

---

# 5. Provedor, modelo e runtime

Três regras, e elas se repetem em toda a marca.

**(a) Aceite um endereço, não um fornecedor.**

> Não cole o adaptador no aparelho. Faça o aparelho aceitar qualquer tomada.

Um campo de endereço configurável, com teste de conexão e listagem dos modelos que aquele
endereço anuncia. Aí o 9Router funciona sem uma linha de código dedicada a ele, qualquer
outro gateway compatível também, e você não herda dependência de nada.

Você já tem esse padrão escrito e funcionando — é o que a Lia faz com o AllTalk:
*"remember an address the user typed"*. É a mesma gaveta.

**Não escreva nome de fornecedor em lugar nenhum do produto** — nem no código, nem na
interface, nem na porta padrão. "Serviço de IA", não a marca da vez.

**E o teste de conexão precisa ser um teste de trabalho.** Pedir um "oi" e receber resposta
não prova nada: há provedor que conversa e rejeita o formato em blocos que um agente usa
para chamar ferramenta. Se o seu app vai pedir ferramenta ao modelo, o teste de conexão
manda uma ida-e-volta de ferramenta de mentira e confere se volta inteira. Melhor falhar
no botão "Testar" do que no meio do trabalho do usuário.

**(b) `localhost` nunca fixo no código.** Se o app rodar em outro lugar que não a máquina
do modelo, `localhost` deixa de existir. Isso cobre nuvem, rede local e celular de uma vez.

**(c) Nunca embarcar chave sua.** Cota grátis de provedor comercial é **por usuário**,
vinculada à conta dele. Distribuir sua chave é violação de termos e conta sua a pagar.

**Se o app for dirigir um agente de código** (como o Studio faz), use linha de comando por
`subprocess`, não o SDK oficial: o SDK fala um fornecedor só e transforma o seu Runtime
Registry em decoração. Cada runtime vira um adaptador de cinco campos — executar uma vez,
saída de máquina, resposta com schema, permissão sem perguntar, continuar sessão.

---

# 6. A conexão opcional com a Lia Waifu

Este é o contrato que todo app da marca assina. Ele generaliza o seu
`LIA-PROJECT-INTEGRATION.md` para além do Studio.

## 6.1 As seis cláusulas

1. **Ausência é normal, não é erro.** Sem a Waifu, o app abre, funciona e não reclama.
   No máximo um aviso discreto de "não conectada".
2. **A ponte é declarada, não descoberta.** O app publica uma lista curta de verbos que
   aceita (*"adicionar item ao roteiro"*, *"registrar gasto"*) e **nada mais**. A Waifu
   nunca toca na estrutura interna do app.
3. **Conversa não é autorização.** Falar com a Lia nunca, sozinho, grava arquivo, roda
   comando, gasta dinheiro ou publica. Quem concede permissão é o app, na interface dele,
   com o escopo à vista.
4. **A cadeia inteira aparece.** *"A Lia está pedindo, em seu nome, que o Lia Go registre
   um gasto de R$ 120"* — nunca um pedido anônimo.
5. **Dado atravessa por categoria, com opt-in e revogação.** Memória de convivência não vai
   pro app por padrão; dado do app não vira memória de convivência por padrão. As duas
   direções.
6. **Ponte caída, os dois continuam.** Sem degradar função nenhuma que não dependa
   literalmente da outra ponta.

## 6.2 O risco que a cláusula 3 evita

O usuário confia na Lia porque ela é a companheira dele. Essa confiança **não pode virar
permissão de escrita em disco** porque a frase passou por três camadas. É lavagem de
permissão, e é o jeito mais fácil de transformar um recurso simpático num incidente.

## 6.3 Profundidade

```
Usuário → Lia (coordenadora) → App (líder) → runtime/ferramenta (trabalhador)
```

Três níveis. O seu `AI-AGENTS-ARCHITECTURE.md` §4.7 já exige limite de profundidade e dá
exatamente esse exemplo. Delegação recursiva sem teto não é permitida.

---

# 7. Pronto é quando

Um app novo da marca está pronto para a primeira entrega quando:

- [ ] abre pelo `.exe` numa máquina **sem** Python, sem git e sem console;
- [ ] a primeira abertura não pede nada além do que só o usuário pode dar;
- [ ] funciona com a Waifu ausente, com a internet ausente e sem conta;
- [ ] o trabalho do usuário está numa pasta que ele acha, copia e apaga sozinho;
- [ ] `--diagnostico` imprime todos os caminhos e a fonte de cada um;
- [ ] desinstalar remove o programa e **pergunta** sobre os dados, mostrando o tamanho;
- [ ] `THIRD_PARTY_NOTICES.md` está completo e confere com o que está no instalador;
- [ ] nenhuma chave, token ou segredo no repositório, no log ou na interface;
- [ ] o README diz o que **não** está pronto com a mesma clareza do que está;
- [ ] nada no app afirma ter executado algo que não executou.

---

# 8. O que não fazer

- **Não** deixar o `CLAUDE.md` crescer. Passou de duas páginas, virou skill.
- **Não** presumir que o app está dentro de um checkout git em tempo de execução.
- **Não** escrever em `C:\Program Files\`.
- **Não** colocar dado grande em pasta sincronizada com OneDrive.
- **Não** cair no caminho padrão em silêncio quando o registrado sumiu — pergunte.
- **Não** sobrescrever o `lia.json` inteiro; leia, mescle, grave atômico.
- **Não** embutir provedor, modelo, runtime ou chave.
- **Não** fazer o app depender da Waifu para nada que ele saiba fazer sozinho.
- **Não** declarar PASS sem ter executado na plataforma-alvo.

---

## O que não foi verificado

- Nada aqui foi executado. Não há PowerShell neste ambiente.
- O comportamento do empacotador (`sys.frozen`, `sys._MEIPASS`) vem da documentação do
  PyInstaller; confirme na versão que você usar.
- A precedência `CLAUDE.md` × `AGENTS.md` está documentada pela Anthropic, mas no
  Lia-Project ela ainda precisa ser confirmada com `/memory` (ver `01-GUIA-LIA-PROJECT.md`).
