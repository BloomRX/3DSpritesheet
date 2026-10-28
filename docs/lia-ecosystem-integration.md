# Lia Forge no ecossistema Lia

Atualizado em 2026-10-28. Esta é a adaptação do kit `docs/Lia.zip` ao app já existente: **Electron + React/Vite**, com um launcher de desenvolvimento auxiliar em Python. O kit Windows é referência, não um comando para trocar a stack.

## Princípios adotados

- **App autônomo:** Lia Forge não depende da Lia Waifu, de internet, de conta ou de agente externo para abrir e usar os fluxos já implementados.
- **Ação explícita:** instalar ferramentas, enviar um workflow, baixar pesos, substituir arquivos ou encerrar processos exige ação do usuário. O app não instala ComfyUI, drivers ou pesos automaticamente.
- **Verdade sobre o trabalho:** um status concluído exige arquivos reais verificados. As validações PNG/JSON não certificam qualidade visual nem semântica do modelo.
- **Trabalho sob controle do usuário:** assets e histórico ficam no workspace escolhido, em `.spriteforge/`; a instalação não é o lugar dos projetos.
- **Agentes opcionais:** handoff/MCP serve a Claude Code, Codex, OpenCode e ferramentas compatíveis, mas Lia Forge também pode ser usada por sua própria interface. Handoff não significa que Lia Forge esteja executando esses agentes.
- **Neutralidade com transparência:** o ComfyUI é hoje o único adapter de geração de conceito implementado. É explicitamente opcional e tem endpoint configurável por `COMFYUI_URL`; o produto não finge oferecer um backend genérico que ainda não existe. Blender é outro adapter, para renderizar um modelo existente.
- **Waifu opcional e revogável:** não há ponte, protocolo, descoberta, envio de memória ou comando remoto da Lia Waifu implementado aqui. Não se deve inferir uma integração a partir do nome da marca ou do MCP para agentes.

## Caminhos de dados

- **Workspace explícito:** `SPRITEFORGE_PROJECT_ROOT` tem precedência e pode apontar diretamente para um projeto de jogo existente.
- **Workspace instalado:** sem override, o Electron empacotado usa `%USERPROFILE%\Lia\Forge` no Windows (equivalente sob a pasta pessoal nos outros sistemas). `LIA_HOME` troca a raiz comum; o workspace da Forge fica em `LIA_HOME/Forge`.
- **Compatibilidade com a pasta antiga:** se o app empacotado encontrar `Documents/Lia Forge`, pergunta qual workspace abrir. Não move, renomeia ou apaga arquivos. Se a pessoa escolher a nova pasta, a antiga permanece intacta para uma migração manual e conferida.
- **Limite atual de configuração:** a raiz ainda não tem seletor dentro da interface. Use `SPRITEFORGE_PROJECT_ROOT` para apontar a um projeto/workspace ou `LIA_HOME` para mudar a raiz comum; uma tela de armazenamento/alteração de pasta permanece pendente.
- **Formato legado:** `.spriteforge/assets.json`, `.spriteforge/runs/` e o namespace MCP `spriteforge_*` permanecem para compatibilidade. A pasta selecionada é visível e pode ser copiada pelo usuário.
- **Destino de pesos do downloader de desenvolvimento:** o launcher resolve `LIA_MODELOS`; sem override, usa `%LOCALAPPDATA%\Lia\Modelos` no Windows (`XDG_DATA_HOME/Lia/Modelos` em sistemas Unix). A lista de modelos em `spriteforge.config.json` permanece vazia. Aceites de licença, se um modelo vier a ser configurado, ficam em `%APPDATA%\Lia\Forge\config\model-license-acceptances.json`, vinculados ao ID/URL/checksum — nunca no código versionado. Este ajuste **não** instala, lista ou baixa peso algum. O ComfyUI continua administrando os próprios diretórios; Lia Forge só lê o que o endpoint reporta.

O diagnóstico `lia-forge diagnostico`/`doctor` mostra os caminhos resolvidos e se existem, sem criá-los. O executável Electron precisa ser validado na máquina-alvo; o diagnóstico do launcher Python é ferramenta de desenvolvimento/suporte, não prova de execução do instalador.

## Limites e trabalho em aberto

1. **Descoberta compartilhada da marca:** `%APPDATA%\Lia\lia.json`, registro `HKCU\Software\Lia`, mesclagem atômica e descoberta de instalações Waifu/Studio são uma proposta do guia. Não há schema/protocolo comum versionado neste app; não implementamos uma falsa conexão.
2. **Ponte com a Waifu:** qualquer implementação futura exige verbos explícitos, opt-in, revogação, identificação de quem pede a ação e aprovação na própria Lia Forge. Conversa não é autorização.
3. **Armazenamento do Electron:** assets sincronizam para o workspace; dados auxiliares internos do Chromium/Electron ainda seguem o diretório padrão do Electron. Não foram movidos porque isso exigiria migração real do estado anterior.
4. **Instalador Windows:** configuração NSIS por usuário e caminhos são escritos no repositório, mas build, primeira execução, prompt de workspace legado, desinstalação e fluxo sem Python/git/console ainda precisam de prova em Windows real.
5. **Modelos:** ainda não existe seleção de provider/modelo aprovada; downloads continuam bloqueados pelo catálogo vazio. Antes de habilitar um peso, exigir escolha explícita, URL HTTPS, SHA-256, licença/tamanho e consentimento. O bootstrapper serializa downloads do mesmo arquivo e recupera locks parados há uma hora, mas não existe catálogo/índice compartilhado nem coordenação com outros gestores de modelos; isso também precisa de projeto antes de habilitar pesos.
6. **Neutralidade futura:** novos adapters devem ser opcionais e receber endpoint/configuração do usuário. Não use abstração genérica na UI enquanto só houver um backend real; nomeie o ComfyUI onde isso for necessário para transparência.

## Divisão de responsabilidades

- **Feito por Git neste repositório:** arquivos de marca, instruções de agente, memória do projeto, licença/notices, configuração e testes de paths, documentação e defaults de código.
- **Pendente na máquina Windows do usuário:** executar `npm ci`, `npm test`, `npm run build`, `npm run package:win`; abrir o instalador, conferir a raiz e os diálogos; validar Blender instalado via Steam e ComfyUI somente se o usuário iniciar/configurar; revisar o layout desktop e o fechamento seguro. Nada disso pode ser declarado PASS sem execução real.
