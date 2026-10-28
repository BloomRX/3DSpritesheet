---
name: lia-brand-check
description: Audita uma mudança da Lia Forge contra os princípios de autonomia, dados do usuário, consentimento, transparência e integração opcional. Use ao alterar interface, armazenamento, IA, instalação, handoff ou comunicação com outro app. Não use como substituto de teste funcional ou revisão jurídica.
---

# Revisão de integração da marca Lia

## Quando usar

- Antes de finalizar mudanças em armazenamento, setup, modelos, endpoints, handoff, tarefas automáticas ou identidade visível.
- Ao revisar se uma nova integração torna a Lia Forge dependente de outro app ou serviço.

## Quando NÃO usar

- Para declarar que um runtime foi testado ou que a saída é visualmente correta → execute a verificação real indicada em `memory-bank/padroes.md`.
- Para instalar ou baixar ferramentas, pesos ou dependências na máquina do usuário → isso requer autorização explícita.

## O que ler primeiro

- `docs/lia-ecosystem-integration.md` — decisões e limites específicos da Lia Forge.
- `docs/guia-externo/00-PADRAO-DA-MARCA.md` — padrão completo de dados, instalação e ecossistema.
- `docs/guia-externo/01-GUIA-APP-NOVO.md` — princípios de autonomia, consentimento e ponte opcional.
- `memory-bank/decisoes.md` — rótulo e estado das decisões.

## Processo

1. Identifique quem inicia a ação, que dados saem do computador, onde os arquivos serão gravados e o que pode ser encerrado ou sobrescrito.
2. Confirme que o app continua utilizável sem Lia Waifu, sem agente externo e sem internet quando a função não depender dela.
3. Exija ação explícita antes de instalar, enviar, gastar, substituir ou executar; mostre o destino e preserve opção de cancelar.
4. Verifique se uma etapa só passa a concluída após produzir e validar os arquivos reais esperados.
5. Verifique que paths e configuração não gravam trabalho na pasta de instalação nem em local sincronizado sem escolha do usuário.
6. Registre como `proposto` ou `em aberto` tudo que não foi implementado ou validado na plataforma-alvo.

## Saída esperada

Uma lista curta com: `OK`, `RISCO` ou `PENDENTE` para autonomia, dados, consentimento, transparência, neutralidade de fornecedor, conexão Waifu opcional/revogável e testes reais. Cite arquivos e indique próximos passos verificáveis.

## Limites

- Não cria uma ponte com a Lia Waifu nem presume protocolo, endpoint, credenciais ou verbos.
- Não instala ferramentas, modelos, drivers ou agents.
- Não converte testes simulados em comprovação de runtime ou qualidade visual.
- Não altera identidade visual nem licencia marca sem autorização.
