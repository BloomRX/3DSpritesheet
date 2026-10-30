# Lia Forge — instruções do agente

Lia Forge é um app desktop Electron/React para organizar a produção de assets de jogos e pertence ao ecossistema Lia. Deve funcionar sem a Lia Waifu e sem um agente externo. Leia `docs/lia-ecosystem-integration.md` para o estado real da integração e os limites da marca.

## Antes de qualquer trabalho

1. Leia `docs/BRAND-STANDARDS.md` para as regras comuns de marca.
2. Leia `docs/guia-externo/` e `docs/lia-ecosystem-integration.md`; o kit externo é referência, enquanto a adaptação da Forge define o que se aplica.
2. Leia `memory-bank/estado.md`; ele distingue o que foi executado do que continua pendente.
3. Leia `memory-bank/padroes.md` para os comandos de teste e convenções; consulte `memory-bank/decisoes.md` antes de alterar identidade, armazenamento, modelos, instalação ou integração entre apps.

## Stack definida

- Electron (processo principal CommonJS), React 18 e Vite 6; Node.js mínimo 22.12.
- Scripts de bootstrap e testes auxiliares em Python 3.8+ com biblioteca padrão; o script de render usa `bpy` fornecido pelo Blender.
- Mantenha a stack. Não introduza serviços, agentes, drivers, ferramentas ou pesos como dependências obrigatórias.

## Regras que valem sempre

- Responda e escreva a interface em pt-BR.
- Preserve trabalho preexistente. Nunca use `git reset --hard`, `git restore`, `git clean`, `git stash`, `git rebase`, `git commit --amend` ou force-push.
- Nunca declare execução, render, geração, PASS de Windows ou entrega de arquivo sem evidência real. Teste simulado não é execução real.
- Não instale ComfyUI, Krita, Blender, drivers, modelos/pesos nem aceite licenças por conta própria. Ações externas precisam de consentimento explícito; a lista de pesos começa vazia.
- Agente externo e conexão com a Lia Waifu são opcionais. Não invente uma ponte com a Waifu: nenhuma integração funcional está implementada neste repositório.
- Seja explícito antes de enviar prompt, referência ou outro dado a um servidor configurado pelo usuário. Não embuta chaves, tokens ou segredos no código, nos logs ou em arquivos versionados.
- Não marque uma etapa como concluída sem os artefatos reais esperados, existentes e estruturalmente validados. Validação estrutural não prova qualidade visual.
- Preserve o layout desktop, a leitura de textos pequenos e o fluxo seguro de fechamento, que não deve encerrar processos externos.
- Dados de trabalho ficam no workspace visível escolhido pelo usuário; não grave assets na pasta de instalação. Não mova dados antigos em silêncio.
- `.claude/rules/` é versionado; ignore apenas arquivos locais indicados no `.gitignore`.

## Verificação

- `npm test`
- `npm run build`
- `python -m unittest discover -s tests -v`
- `git diff --check`

Blender, ComfyUI, empacotamento e execução no Windows só contam como verificados quando executados de verdade na plataforma correspondente. Informe o que foi rodado e o que ficou pendente.

## Onde manter o contexto

- Estado atual e bloqueios: `memory-bank/estado.md`
- Convenções e testes: `memory-bank/padroes.md`
- Decisões com rótulo: `memory-bank/decisoes.md`
- Referência e integração da marca: `docs/lia-ecosystem-integration.md` e `docs/guia-externo/`
