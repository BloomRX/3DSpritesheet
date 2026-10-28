# Padrão de pastas, distribuição e a regra do pip

Proposta para a marca Lia inteira — Waifu, Studio, GPS e o que vier depois.
Escrito em 18/10/2026. **Isto é plano, não script.** Nada aqui foi executado.

---

# 1. A regra do pip, reescrita

Decisão do Dev: a regra sai como estava e vira uma regra em camadas.

## 1.1 O texto novo

Substitui o *"apenas biblioteca padrão — sem `pip install`"* do README:

> **Dependências**
>
> 1. **Núcleo (`app/lia/`): biblioteca padrão apenas.** Estado, estágios, gates,
>    permissões, evidência e armazenamento não dependem de pacote de terceiro.
> 2. **Shell, adaptadores e build: dependência permitida**, fixada por versão exata e
>    registrada no `THIRD_PARTY_NOTICES.md` com licença e finalidade.
> 3. **Na máquina do usuário final: nunca roda `pip`, nunca precisa de Python instalado,
>    nunca aparece erro de dependência.** O instalador entrega tudo pronto.
> 4. `python run.py` continua funcionando em qualquer máquina com Python 3.9+, como
>    caminho de desenvolvedor e rede de segurança.

## 1.2 Por que a camada 1 fica

Não é teimosia. O núcleo sem dependência entrega três coisas que valem num app **grátis,
distribuído a leigos**:

- **Risco zero de pacote comprometido** na parte que decide permissão e grava evidência.
- **Nenhum inferno de versão** — nada quebra porque uma dependência transitiva subiu.
- Um núcleo **auditável**, que é boa parte da clareza do repositório hoje.

A regra só estava errada quando virava absoluta e vazava pro shell e pro build — onde o
mundo real (WebView2, empacotamento, adaptadores) precisa entrar.

## 1.3 O que muda nos guias

Uma coisa só, e já está corrigida no `GUIA-LIA-STUDIO.md`: a recomendação de usar
`subprocess` em vez do SDK oficial **continua**, mas o motivo passa a ser **neutralidade de
fornecedor** (o SDK fala Claude e só; `subprocess` mantém Codex, OpenCode, Kimi e
Antigravity possíveis), não economia de dependência.

---

# 2. Dois caminhos de entrega, um comportamento só

O repositório fica para quem usa git. O `.exe` fica para quem não usa. **O mesmo app.**

## 2.1 As quatro regras que evitam o bug clássico

| # | Regra | O que ela evita |
|---|---|---|
| 1 | O app **nunca** presume estar dentro de um checkout git. Nenhuma chamada a `git` em tempo de execução, nenhum caminho relativo apontando pra arquivo do repositório. | O `.exe` quebrar porque procurou um `.git` que não existe. |
| 2 | Todo caminho sai de **uma função só** (`caminhos.py`), que detecta se está empacotado (`sys.frozen` / `sys._MEIPASS` no PyInstaller) ou rodando do fonte. Nenhum outro módulo monta caminho na mão. | O bug nº 1 de app Python empacotado: funciona no `run.py`, não acha nada no `.exe`. |
| 3 | **As pastas de dados são idênticas nos dois modos.** Quem testou pelo repositório e depois instalou o `.exe` encontra os mesmos projetos, as mesmas memórias, as mesmas configs. | O usuário achar que perdeu tudo ao trocar de caminho de instalação. |
| 4 | Instalação **por usuário**, em `%LOCALAPPDATA%\Programs\Lia\<App>` — sem pedir administrador. | O aviso de UAC logo de cara, que derruba metade dos leigos. É o que VS Code, Discord e Slack fazem. |

## 2.2 Uma verificação que vale ter

Um comando `--diagnostico` que imprime: modo (fonte ou empacotado), versão, e cada pasta
que o app vai usar, com ✓ existe / ✗ não existe. Quando algo der errado na máquina de
outra pessoa, isso resolve em uma mensagem em vez de dez.

---

# 3. Onde cada coisa é salva

## 3.1 A resposta curta

Nem tudo na pasta do app, nem tudo espalhado. **Divide por tipo de dado, mas com o nome
`Lia` em todos os lugares** — e uma pasta visível que junta o que interessa ao usuário.

Três perguntas resolvem qualquer caso:

1. **O usuário criou isso?** → pasta visível dele.
2. **Dá pra regenerar sem perda?** → `%LOCALAPPDATA%`, que não faz backup nem roaming.
3. **É segredo?** → Gerenciador de Credenciais do Windows, nunca arquivo.

## 3.2 A tabela

| O que é | Onde | Por quê |
|---|---|---|
| Executável e arquivos do programa | `%LOCALAPPDATA%\Programs\Lia\<App>\` | instalação por usuário, sem admin |
| **Projetos de jogo, memórias, textos, vozes gravadas** | `%USERPROFILE%\Lia\<App>\` | é o trabalho **dele**; tem que ser fácil de achar, copiar e levar embora |
| Configurações (pequenas, devem sobreviver a update) | `%APPDATA%\Lia\<App>\config\` | Roaming: pequeno, viaja com o perfil |
| Cache, logs, índices, miniaturas | `%LOCALAPPDATA%\Lia\<App>\cache\` · `\logs\` | regenerável; **não** pode entrar em backup nem roaming |
| **Modelos de IA e motores de inferência** (pesos, AllTalk, Live2D) | `%LOCALAPPDATA%\Lia\Modelos\` — **uma pasta para a marca inteira**, relocável | são gigabytes; jamais em Roaming; precisam poder ir pro `J:`. Ver **4.4** |
| Chaves de API e tokens | **Gerenciador de Credenciais do Windows** | arquivo em texto vaza em print, backup e suporte |
| Nada | `C:\Program Files\` | escrever ali exige admin e irrita o antivírus |

## 3.3 Por que não jogar tudo em `Documentos`

Parece a escolha óbvia e tem uma armadilha séria: **no Windows atual a pasta Documentos é
sincronizada com o OneDrive por padrão** em boa parte das instalações.

Se os pesos de modelo e o cache caírem lá, o usuário começa a subir **gigabytes** pro
OneDrive sem saber, estoura a cota gratuita dele e leva a culpa pro seu app.

Por isso a raiz visível proposta é `C:\Users\<nome>\Lia\`, e não `Documentos\Lia\`. Aparece
no Explorer logo na pasta do usuário, é achável na busca, e fica fora do OneDrive por
padrão. Se o Dev preferir Documentos, que seja **escolha explícita do usuário**, com aviso.

---

# 4. O padrão `Lia\` — uma marca, um lugar

## 4.1 A raiz visível

```
C:\Users\<nome>\Lia\
├── LEIA-ME.txt              o que é cada pasta, em português, 10 linhas
├── Waifu\
│   ├── Memorias\            conversas, fatos, o que ela lembra
│   ├── Vozes\               áudios de referência do usuário
│   └── Perfis\              o que ele montou no launcher, exportável
├── Studio\
│   ├── Projetos\            os jogos  (hoje: ~\LiaStudioProjects)
│   └── Skills\              as skills que ele mesmo escreveu
├── GPS\                     a próxima ferramenta, mesmo molde
└── Comum\
    ├── Marca\               ícones, fontes, identidade
    └── Backups\
```

Uma pessoa que procura "Lia" no computador acha **isso**. É o que ela quer: o trabalho
dela. Não precisa ver cache nem peso de modelo.

## 4.2 O mesmo prefixo nos lugares técnicos

```
%LOCALAPPDATA%\Lia\Waifu\{cache,logs}
%LOCALAPPDATA%\Lia\Studio\{cache,logs}
%LOCALAPPDATA%\Lia\Modelos\            UMA pasta para todos os apps (ver 4.4)
%APPDATA%\Lia\Waifu\config\
%APPDATA%\Lia\Studio\config\
%LOCALAPPDATA%\Programs\Lia\Waifu\
```

Assim a marca é consistente em **todo** lugar: quem for fuçar o AppData também encontra
tudo junto, sob `Lia\`. E desinstalar fica honesto — dá pra listar exatamente o que
existe.

## 4.3 O truque do junction, de novo

Você já usa isso duas vezes: no vault do Obsidian e no espelho das skills. Terceira
aplicação, mesmo princípio — **uma pasta, duas portas de entrada**, sem cópia e sem admin:

```
C:\Users\<nome>\Lia\Waifu\_tecnico\   →  %LOCALAPPDATA%\Lia\Waifu\
C:\Users\<nome>\Lia\_modelos\         →  %LOCALAPPDATA%\Lia\Modelos\
```

Quem quiser ver o lado técnico entra por ali. Quem não quiser, nem percebe. E se o usuário
mandar os modelos pro `J:`, o junction continua apontando certo — **junction cruza drive**,
que é justamente por que ele funciona no seu caso do `C:` para o `J:`.

⚠ **Testar antes de virar padrão:** o OneDrive normalmente ignora ponto de reparse
(junction), mas isso precisa ser confirmado na máquina real. Se ele **seguir** o junction,
o usuário sincroniza gigabytes sem saber — exatamente o problema que a seção 3.3 evita.

## 4.4 Modelos de IA: uma pasta para a marca inteira

Se a Waifu e o Studio usarem o mesmo modelo, baixar duas vezes é jogar fora gigabytes de
disco e de internet do usuário. Então a pasta é **uma só, compartilhada de propósito**:

```
%LOCALAPPDATA%\Lia\Modelos\        ← não existe Lia\Waifu\Modelos
```

Não é organização, é economia: um Qwen Omni quantizado passa fácil dos 15 GB. Duas cópias
é um disco de notebook inteiro.

### 4.4.1 Antes de tudo: nem todo jeito de usar IA ocupa disco

A pasta só existe por causa do primeiro caso. Os outros dois não baixam nada:

| Modo | Onde o modelo roda | Ocupa disco? | O que o app guarda |
|---|---|---|---|
| **Na máquina** | no PC do usuário | **sim, muito** | o arquivo do modelo |
| **Servidor dele** (Colab, uma máquina na LAN, um túnel) | fora, mas é dele | não | **um endereço que ele digitou** |
| **Serviço de terceiro** (um gateway qualquer: 9Router, FreeLLMAPI, OpenRouter…) | fora, de outra pessoa | não | endereço + chave no Gerenciador de Credenciais |

Os três têm que funcionar, e **quem escolhe é o usuário** — no launcher da Waifu, nas
preferências do Studio. Isso é a regra nº 4 da marca de novo: *não cole o adaptador no
aparelho*. O app pede um endereço; não lhe interessa o que tem do outro lado.

**Nome de fornecedor nunca entra no código.** Nem `9router`, nem porta `20128`, nem nome de
combo. O produto pede **endereço + chave** e pergunta ao endereço o que ele sabe fazer
(`GET /v1/models`). Quem digitar um gateway usa aquele gateway; quem apontar pro próprio PC
usa o próprio PC. No dia em que um fornecedor fechar, muda uma linha da documentação — não
uma linha do produto. Vale para a interface também: escreva *"serviço de IA"*, não o nome
da marca da vez.

**O modo "servidor dele" tem uma armadilha própria.** Um endereço de Colab ou de túnel
**expira** — às vezes em horas. Então:

- trate queda de conexão como **normal**, não como erro de programação: avise em uma frase
  e ofereça trocar de modo, sem travar o app;
- **nunca** grave essa URL como se fosse permanente — ela é um campo editável, sempre
  visível, nunca escondida num arquivo de instalação;
- **não mande segredo** para um endereço que o usuário acabou de colar sem ele saber. Se a
  requisição leva chave ou dado pessoal, diga **para onde** está indo, na tela.

### 4.4.2 O layout: nome com versão junto

A Waifu pode querer o modelo leve e o Studio o pesado. Se a pasta se chamar só
`qwen-omni`, um sobrescreve o outro e o app do outro quebra sem explicação. Então o nome
da pasta carrega **tudo que faz dois arquivos serem diferentes**:

```
%LOCALAPPDATA%\Lia\Modelos\
├── indice.json                       o catálogo (ver 4.4.4)
├── llm\
│   ├── qwen3-omni-30b-q4_k_m.gguf
│   └── qwen3-omni-30b-q8_0.gguf      coexistem, são arquivos diferentes
├── voz\
│   └── xtts-v2\
├── visao\
└── _parcial\                         downloads em andamento (ver 4.4.3)
```

Regra: **família + tamanho + quantização + formato**. Mesmo modelo em GGUF e em ONNX são
dois arquivos; não tente ser esperto.

### 4.4.3 As quatro regras que evitam o bug clássico

Compartilhar pasta entre programas é um problema conhecido e tem quatro armadilhas. Todas
já aconteceram com outros produtos:

**(a) Dois apps baixando o mesmo arquivo ao mesmo tempo.** A Waifu e o Studio abertos, os
dois percebem que falta o Qwen, os dois começam a baixar no mesmo caminho. O arquivo sai
corrompido e o usuário não tem como adivinhar o porquê.
→ **Trava.** Antes de baixar, o app cria `qwen3-omni-30b-q4_k_m.gguf.lock` com o próprio
PID e a hora. Quem achar uma trava **viva** espera e mostra *"outro app da Lia está
baixando este modelo"*. Trava com mais de 1 hora sem o arquivo crescer é considerada morta
e pode ser tomada — senão um app que travou deixa o modelo inacessível pra sempre.

**(b) Download pela metade vira "bug do seu código".** Queda de internet no meio, fica um
arquivo com o nome certo e o tamanho errado. Na próxima abertura o app acha que está tudo
ali, tenta carregar e explode num erro que não diz nada.
→ **Baixe em `_parcial\` e só renomeie no fim.** Um arquivo no lugar definitivo é, por
definição, um arquivo completo. É a mesma ideia do "ler-mesclar-gravar atômico" da
seção 5.

**(c) Arquivo corrompido ou trocado.** Tamanho certo não garante conteúdo certo.
→ **Confira o hash** (SHA-256) uma vez, ao terminar o download, e grave o resultado no
índice. Não refaça a cada abertura — num arquivo de 15 GB isso custa dezenas de segundos
de inicialização. Confira de novo só quando o carregamento falhar.

**(d) Desinstalar a Waifu quebra o Studio.** É o pior dos quatro, porque o usuário nunca
vai ligar uma coisa à outra: ele desinstalou um programa e **outro** parou de funcionar.
→ **Lista de quem usa.** Cada modelo registra quais apps o referenciam. Desinstalador só
oferece apagar modelo que **nenhum outro app usa**; para os demais, não pergunta nem
menciona. E nunca apaga modelo em silêncio — mostra o tamanho e espera resposta.

### 4.4.4 O catálogo

Um `indice.json` na raiz de `Modelos\`, no mesmo formato de bilhete da seção 5 —
**ler, mesclar, gravar atômico**, porque dois apps escrevem nele:

```json
{
  "versao": 1,
  "modelos": {
    "qwen3-omni-30b-q4_k_m.gguf": {
      "caminho": "llm/qwen3-omni-30b-q4_k_m.gguf",
      "bytes": 18453211136,
      "sha256": "…",
      "verificado_em": "2026-10-18T14:02:00Z",
      "origem": "https://…",
      "usado_por": ["Waifu", "Studio"]
    }
  }
}
```

Serve pra três coisas: o app descobre o que já existe sem varrer 40 GB de disco; o
desinstalador sabe o que pode apagar; e uma tela de "Armazenamento" consegue mostrar o que
ocupa espaço e o que não é usado há meses.

**O índice é conveniência, não verdade.** Se ele disser que o arquivo existe e o arquivo
não estiver lá, vale o disco — corrige o índice e segue. Nunca dê erro ao usuário por
causa de um arquivo de catálogo.

### 4.4.5 Quem baixa, e com que permissão

Baixar 15 GB é uma decisão do usuário, não do app.

- O app **mostra o tamanho e pergunta** antes do primeiro download. Sempre.
- Se o modelo já estiver na pasta (outro app baixou), **não pergunta nada** — usa. É esse
  o ganho de compartilhar.
- Falta de modelo **nunca** é tela de erro: é uma escolha — *baixar*, *usar meu servidor*,
  *usar serviço online*. Os três modos da 4.4.1 estão sempre a um clique.
- Modelo é arquivo grande e regenerável: **nunca** em `%APPDATA%` (Roaming) nem na pasta
  visível `Lia\`, pelo motivo da seção 3.3.

### 4.4.6 Onde o usuário manda

A ordem é a mesma de sempre — o que ele escolheu ganha do padrão:

1. variável `LIA_MODELOS`, se existir;
2. o caminho gravado no bilhete `%APPDATA%\Lia\lia.json` (seção 5);
3. o padrão `%LOCALAPPDATA%\Lia\Modelos`.

Se o caminho estiver gravado e **não existir mais** (o `J:` não está plugado, a pasta foi
movida), vale a regra da seção 5.7: **pergunte**. Nunca volte ao padrão em silêncio e
comece a baixar 15 GB de novo — isso é o tipo de coisa que faz o usuário desinstalar.

### 4.4.7 O limite: modelo é compartilhado, estado não

Isto vale **só para arquivo que dá pra baixar de novo**. Memória, projeto e configuração
continuam separados por app — é a sua própria regra, do `LIA-PROJECT-INTEGRATION.md`:

> *"Lia Project pode enriquecer o Lia Studio; nunca deve ser necessário para o Lia Studio
> existir."*

Modelo compartilhado não cria dependência: se a pasta sumir, cada app baixa o seu e a vida
continua. Estado compartilhado criaria — um app deixaria de funcionar porque o outro foi
embora, que é exatamente o que a sua regra proíbe.

**No celular nada disso existe.** Não há pasta compartilhada entre apps: cada um vive numa
caixa fechada. Lá o modelo ou vem embutido no pacote, ou é baixado por aquele app só, ou
— quase sempre a resposta certa — roda no servidor. Ver `PADRAO-MOBILE-WEB.md`.

## 4.5 Desinstalar

Com tudo sob `Lia\`, a desinstalação pode ser honesta — e isso é raro:

- Remove sempre: o programa e o `%LOCALAPPDATA%\Lia\<App>\` (cache e log).
- **Pergunta** sobre: `%USERPROFILE%\Lia\<App>\` (o trabalho dele) e os modelos baixados.
- Mostra o tamanho de cada um antes de perguntar.
- **Nunca** apaga `%USERPROFILE%\Lia\` em silêncio.

## 4.6 Uma variável de ambiente por raiz

Para teste, para quem quer tudo no `J:`, e para quem usa o app em pendrive:

```
LIA_HOME         raiz visível     (padrão: %USERPROFILE%\Lia)
LIA_DATA         cache e logs     (padrão: %LOCALAPPDATA%\Lia)
LIA_MODELOS      modelos de IA e motores de inferência
                 (padrão: %LOCALAPPDATA%\Lia\Modelos)
```

O Studio já tem o precedente certo com `LIA_PROJECTS_DIR`. É o mesmo desenho, generalizado
para a marca.

## 4.7 Migração do que já existe

O Studio salva hoje em `~\LiaStudioProjects`. Na primeira abertura da versão nova:
detectar a pasta antiga, **mostrar** o que será movido, pedir confirmação, mover, e deixar
um atalho no lugar antigo. Nunca mover calado.

---

# 5. Como um app novo descobre onde os outros já estão

O usuário instala a Waifu, muda a pasta para `J:\MinhaLia`. Seis meses depois instala o
Studio. O instalador do Studio precisa **achar** aquela pasta e propor ficar junto — com
direito a recusar.

## 5.1 O princípio: a raiz pode mudar, o ponteiro não

Se a informação de "onde fica a Lia" morasse dentro da própria pasta da Lia, você teria que
saber onde ela está para descobrir onde ela está. Então:

> **A raiz é móvel. O bilhete que diz onde ela está fica num lugar fixo.**

Esse bilhete vai em dois lugares, de propósito:

| Onde | Para quem | Por quê |
|---|---|---|
| `%APPDATA%\Lia\lia.json` | **o app**, em tempo de execução | legível por qualquer linguagem, fácil de versionar e de migrar |
| `HKCU\Software\Lia` (registro) | **o instalador** | Inno Setup e NSIS leem registro nativamente, numa linha, antes de o Python existir |

Os dois guardam a mesma coisa. `%APPDATA%` e `HKCU` são por usuário e não exigem
administrador — e nenhum dos dois se move quando o usuário muda a pasta da Lia.

## 5.2 O bilhete

`%APPDATA%\Lia\lia.json`:

```json
{
  "versao": 1,
  "home":     "J:\\MinhaLia",
  "dados":    "C:\\Users\\lucas\\AppData\\Local\\Lia",
  "modelos":  "J:\\MinhaLia\\_modelos",
  "apps": {
    "waifu":  { "home": "J:\\MinhaLia\\Waifu",  "versao": "1.2.0", "instalado_em": "2026-10-18" },
    "studio": { "home": "J:\\MinhaLia\\Studio", "versao": "0.5.0", "instalado_em": "2026-11-02" }
  }
}
```

Três decisões embutidas aí:

- **`home` é a raiz comum, mas cada app guarda a sua.** Isso permite que o usuário recuse
  a sugestão sem quebrar nada — divergir é um estado legal, não um erro.
- **`dados` (cache e log) não acompanha a raiz visível por padrão.** O sentido do
  `%LOCALAPPDATA%` é justamente ser descartável e ficar fora de backup. Mover junto
  anularia isso. Pode ser trocado, mas não por acidente.
- **`modelos` é campo próprio.** É o maior volume e o mais provável de ir pra outro drive.

E dentro da raiz vai um arquivo marcador vazio, `.lia-home`. É o que permite confirmar
*"esta pasta é mesmo uma raiz da Lia"* sem vasculhar o disco.

## 5.3 Ordem de precedência

Todo app resolve os caminhos sempre nesta ordem, parando no primeiro que valer:

| # | Fonte | Para quê |
|---|---|---|
| 1 | variável `LIA_HOME` | teste, modo portátil, suporte |
| 2 | config do próprio app (`%APPDATA%\Lia\<App>\config\`) | este app já foi configurado; respeita |
| 3 | bilhete compartilhado (`lia.json`, ou registro se o JSON faltar) | **é aqui que a detecção acontece** |
| 4 | padrão `%USERPROFILE%\Lia` | primeira instalação da marca |

## 5.4 As três telas do instalador

**(A) Nenhuma Lia na máquina**

```
Onde salvar seus arquivos da Lia?

  [ C:\Users\lucas\Lia                    ]  [ Procurar... ]

  Aqui ficam seus projetos, memórias e vozes.
  Você pode mudar depois, nas configurações.
```

**(B) Achou outra Lia — o caso que você pediu**

```
Encontramos a Lia Waifu em:
    J:\MinhaLia

  (•) Guardar o Studio junto          recomendado
      → J:\MinhaLia\Studio

  ( ) Usar outra pasta
      [                               ]  [ Procurar... ]

  Manter junto facilita achar, fazer backup e conectar os apps depois.
```

O recomendado vem **pré-selecionado**. Quem só clica "Avançar" acaba com tudo organizado
sem ter pensado no assunto — que é o comportamento certo pro público leigo.

**(C) Achou o registro, mas a pasta sumiu**

```
A Lia Waifu está registrada em J:\MinhaLia, mas essa pasta não foi encontrada.
O drive pode estar desconectado.

  ( ) Vou conectar o drive — tentar de novo
  ( ) Usar a pasta padrão  C:\Users\lucas\Lia
  ( ) Escolher outra pasta
```

**Nunca** cair no padrão em silêncio. Esse é o caminho mais curto para o usuário terminar
com duas Lias pela metade e achar que perdeu as memórias.

## 5.5 Validar antes de confiar no que está escrito

Caminho gravado não é caminho válido. Antes de usar, conferir:

| Checagem | Se falhar |
|---|---|
| a pasta existe? | tela (C) |
| tem o marcador `.lia-home`? | pedir confirmação — pode ser pasta de outra coisa |
| dá para escrever nela? | avisar e oferecer outra |
| está em drive removível ou de rede? | avisar: o app não abre com o drive fora |
| está dentro de pasta sincronizada (OneDrive/Drive/Dropbox)? | avisar sobre o volume dos modelos |
| o caminho passa de 260 caracteres? | bloquear — projeto de jogo aninha fundo e isso estoura |
| é `Program Files`, raiz de disco ou pasta de sistema? | bloquear |
| já tem conteúdo que não é da Lia? | avisar, nunca misturar calado |

## 5.6 O bug que vai acontecer se ninguém pensar nele

Dois apps escrevendo o mesmo `lia.json`:

> O instalador do Studio lê o arquivo, o usuário atualiza a Waifu no meio, o Studio grava
> de volta o que tinha lido — **e apaga a entrada da Waifu.**

Prevenção, e é barato: **ler, mesclar, gravar em arquivo temporário e renomear por cima**
(renomeação é atômica no Windows). Nunca sobrescrever o arquivo inteiro com o que você
tinha em memória. E cada app mexe **só na sua** chave dentro de `apps`.

Na desinstalação, o app remove **apenas a própria entrada**. Se `apps` ficar vazio, aí sim
o bilhete pode ir embora.

## 5.7 Quando o usuário move a pasta depois

Pelas configurações, não arrastando no Explorer. O fluxo:

1. mostrar o que será movido e o tamanho;
2. copiar, **conferir**, e só então apagar a origem;
3. atualizar o `lia.json` e o registro;
4. oferecer deixar um **junction** no lugar antigo, pra não quebrar atalho que o usuário
   tenha criado;
5. os outros apps releem o bilhete na próxima abertura e seguem sozinhos.

Se o usuário mover na mão pelo Explorer, cai na tela (C) — com a opção "Procurar", onde ele
aponta a pasta e o app confirma pelo marcador `.lia-home`. **Não** varrer o disco atrás
dela: é lento e assusta antivírus.

## 5.8 O que todo app da marca tem que fazer

Vale pra Waifu, pro Studio, pro GPS e pro que vier:

1. **Na instalação:** ler o bilhete, propor a raiz encontrada, aceitar recusa, gravar a
   própria entrada mesclando.
2. **Em toda abertura:** reler o bilhete e seguir se o caminho dele mudou.
3. **Nas configurações:** mostrar as pastas em uso e permitir trocar.
4. **No `--diagnostico`:** imprimir cada caminho resolvido, a fonte que decidiu (1 a 4 da
   seção 5.3) e ✓/✗ de existência. Isso resolve suporte em uma mensagem.
5. **Na desinstalação:** remover só a própria entrada, nunca o trabalho do usuário sem
   perguntar.

# 6. O que muda pelo fato de as sessões só editarem por git

Isso explica uma coisa que eu tinha lido como rigor excessivo nos seus documentos — e que
na verdade é consequência estrutural:

> **As sessões não têm a sua máquina. Elas não podem testar no Windows. Você é o único
> banco de testes que existe.**

Por isso a regra *"teste automatizado verde não é PASS de runtime de agente; o gate é Windows real"*
está certa e deve continuar. Não é paranoia, é a descrição correta do que elas podem e não
podem afirmar.

Três consequências práticas:

**(a) Toda tarefa de setup se parte em duas.** Uma metade é git (a sessão faz), a outra é
máquina (você faz). Exemplo real, o espelho das skills:

| Quem | O quê |
|---|---|
| a sessão, por git | acrescenta `.claude/` ao `.gitignore` e commita |
| **você**, depois do pull | cria o junction e **reinicia o Claude Code** |

Se isso não vier separado, a sessão vai dizer "pronto" com metade feito.

**(b) Elas devem entregar verificação de um passo.** Em vez de "rode a suíte e confira",
um comando que imprime um veredito. O `--diagnostico` da seção 2.2 existe por isso.

**(c) Elas não podem afirmar nada sobre Windows.** Nem "funciona no Windows", nem
"testado". O máximo honesto é *"escrito para Windows, não executado — gate pendente"*. O
`CURRENT-STATE.md` já usa exatamente esse vocabulário. Mantenha.

E uma de minha parte: quando eu entregar `.ps1`, continuo mandando as linhas de desbloqueio
junto, porque script baixado chega bloqueado pelo Windows.

---

# 7. Resumo em uma tela

| Pergunta | Resposta |
|---|---|
| A regra do pip sai? | Vira três camadas. Núcleo stdlib, shell livre, **usuário nunca roda pip**. |
| `.exe` e repositório convivem? | Sim, com caminho centralizado em um módulo e pastas de dados idênticas nos dois modos. |
| Tudo na pasta do app? | Não. **Trabalho do usuário** numa pasta visível; cache no AppData; segredo no Gerenciador de Credenciais. |
| Cada app baixa o próprio modelo de IA? | **Não.** `%LOCALAPPDATA%\Lia\Modelos\` é **uma só** para a marca. Nome com versão junto, trava de download, lista de quem usa (4.4). |
| Modelo de IA é obrigatório? | Não. Três modos sempre disponíveis: na máquina · servidor do usuário (Colab, LAN, túnel) · serviço online. Só o primeiro ocupa disco (4.4.1). |
| Dá pra ter tudo "em um lugar só"? | Sim: prefixo `Lia\` em **todas** as raízes + `C:\Users\<nome>\Lia\` como porta de entrada + junction pro lado técnico. |
| Documentos ou pasta do usuário? | **Pasta do usuário.** Documentos é sincronizada com OneDrive por padrão e viraria desastre com os modelos. |
| Instalar como? | **Por usuário**, sem admin, em `%LOCALAPPDATA%\Programs\Lia\<App>`. |
| O usuário pode mudar a pasta? | Sim, na instalação e depois. O padrão vem pronto e pré-selecionado. |
| Um app novo acha os anteriores? | Sim, pelo bilhete `%APPDATA%\Lia\lia.json` + registro `HKCU\Software\Lia`, que **não se movem** quando a raiz muda. |
| E se ele recusar ficar junto? | Permitido. Cada app guarda a própria raiz; divergir é estado legal. |
| E se a pasta registrada sumiu? | Pergunta. **Nunca** cai no padrão em silêncio — é assim que se cria duas Lias pela metade. |

---

## O que não foi verificado

- **Nada foi executado.** Não há `pwsh` aqui; nenhum caminho foi testado no Windows.
- **O comportamento do OneDrive com junction** precisa de teste real antes de virar
  padrão (4.3). É o único item desta proposta que pode causar estrago se eu estiver errado.
- **O comportamento exato do PyInstaller** (`sys.frozen`, `sys._MEIPASS`) está descrito pela
  documentação dele; confirme na versão que vocês usarem.
- **Não auditei** se algum módulo do Studio hoje monta caminho fora do lugar central — a
  regra 2 da seção 2.1 pode exigir refatoração maior do que parece. Vale a sessão medir
  isso antes de prometer prazo.
- `%USERPROFILE%\Lia\` **não** é sincronizado pelo OneDrive por padrão, mas o usuário pode
  ter mudado isso. O `--diagnostico` deveria avisar quando detectar a raiz dentro de uma
  pasta sincronizada.
- **O mecanismo de descoberta da seção 5 é desenho, não código testado.** `%APPDATA%` e
  `HKCU` serem por usuário e não exigirem administrador é comportamento documentado do
  Windows, mas a implementação inteira — bilhete, mesclagem atômica, as três telas — ainda
  não existe em lugar nenhum.
- **O limite de 260 caracteres de caminho** pode ser contornado com o *long path* do
  Windows 10+, mas depende de chave de política e de o app declarar suporte no manifesto.
  Até alguém confirmar isso na máquina real, trate 260 como o teto e **bloqueie** acima
  disso — projeto de jogo aninha fundo e esse estouro aparece tarde, já com arquivo
  corrompido pela metade.
