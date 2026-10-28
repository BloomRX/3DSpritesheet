# Estado atual — Lia Forge

> Fonte de verdade operacional. Registra estado e evidência; não substitui o relato da tarefa.

Atualizado em: 2026-10-28

## Onde estamos

| Item | Valor |
|---|---|
| Branch de trabalho | `arena/649f88bd-3dspritesheet` |
| Último commit validado na plataforma-alvo | Nenhum. Windows não foi executado neste ambiente. |
| Fase | Orientações do ecossistema Lia adaptadas ao app Electron; gate Windows pendente. |

## Pronto e verificado na plataforma-alvo

- Nenhum item validado em Windows nesta sessão.

## Escrito e executado no sandbox, mas **não** validado na plataforma-alvo

- Documentação da marca, instruções `CLAUDE.md`/`AGENTS.md`, `memory-bank/`, rule de interface e skill neutra.
- Paths de workspace e pesos centralizados por runtime; padrão empacotado `%USERPROFILE%\Lia\Forge` e aviso explícito para workspace legado, sem mover dados.
- Destino compartilhável `LIA_MODELOS` e aceite de licença separado do repositório; o catálogo de pesos segue vazio.
- NSIS configurado para instalação por usuário e avisos/licenças incluídos no pacote.
- Legibilidade de rótulos elevada a 9 px e instruções prioritárias a 10 px; `npm run build` passa. Revisão visual ainda pendente: não há navegador/Chromium instalado no sandbox, e o layout desktop deve ser conferido no Windows.
- Testes locais: `npm test`, `npm run build`, `python -m unittest discover -s tests -v` (26 testes), `py_compile`, `node --check` e `git diff --check`.

## Bloqueios abertos

| O quê | Desde | O que destrava |
|---|---|---|
| Execução real do instalador e do app em Windows | 2026-10-28 | Gerar `npm run package:win` em Windows; abrir, confirmar paths/diálogo legado, fechar com segurança e testar desinstalação sem perder workspace. |
| Blender/ComfyUI reais | 2026-10-28 | Testes manuais na máquina do usuário, somente se ele iniciar/configurar as ferramentas. Nenhuma instalação é autorizada por esta tarefa. |
| Descoberta comum `lia.json` / ponte Waifu | 2026-10-28 | Contrato e consentimento definidos junto ao app Waifu; não inventar protocolo nem declarar integração atual. |

## Próximo passo verificável

1. Fazer pull desta branch e, na máquina Windows, executar o checklist de plataforma em `docs/lia-ecosystem-integration.md`; anotar qualquer divergência antes de marcar PASS.

---

Atualizar este arquivo no mesmo commit quando mudar uma decisão de produto, fase ou validação na plataforma-alvo. Não registrar o tip da branch.
