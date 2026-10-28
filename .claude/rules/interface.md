---
paths:
  - "src/**/*.jsx"
  - "src/**/*.css"
---

# Regras de interface da Lia Forge

- Texto voltado ao usuário em pt-BR, direto e sem esconder custo, destino de dados ou risco da ação.
- Toda área assíncrona precisa de estados de carregamento, vazio e erro; o erro deve indicar o próximo passo útil.
- Não simule geração, progresso, dispositivo, etapa concluída nem arquivo inexistente. Diferencie claramente “planejado”, “enviado”, “em execução” e “validado”.
- Torne visíveis o endpoint configurado e o destino de arquivos quando uma ação puder enviar dados para fora do computador.
- Priorize leitura: texto informativo pequeno deve permanecer legível (alvo mínimo de 9 px; conteúdo importante, 10 px ou mais). Não reduza fonte para compensar overflow; ajuste hierarquia, espaçamento ou quebra de linha.
- Preserve o layout desktop e confira larguras menores sem criar rolagem horizontal acidental; não oculte controles essenciais em telas compactas.
- Mantenha estados de foco/teclado e não dependa só de cor para comunicar status.
- Preserve a confirmação de fechamento: só processos iniciados pela própria Lia Forge podem ser encerrados, depois de confirmação explícita; nunca encerre jobs ou serviços externos.
