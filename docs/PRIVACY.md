# Privacy & Data Handling

## Dados coletados

- Frames JPEG transitórios (processamento backend).
- Métricas faciais (yaw/pitch/roll, confiança, blink).
- Pontos de gaze por página/sessão.
- Comandos gerados (NEXT/PREV/SCROLL).

## Princípios

- Minimização: não persistir vídeo bruto por padrão (`frame_ref` opcional).
- Finalidade: dados usados para acessibilidade, UX e relatório de interação.
- Transparência: usuário deve saber quando rastreamento está ativo.

## Recomendações de produção

- HTTPS em todos os serviços.
- Rotação de `device_key`.
- Políticas de retenção para `frame_events`, `gaze_points` e `commands`.
- Controle de acesso para dashboards e exportações.
- Consentimento explícito quando usado com usuários finais.
- Evitar armazenar imagem bruta; manter `frame_ref` nulo quando não houver necessidade de auditoria.

## Riscos e limites

- Ambiente escuro/oclusões (óculos/reflexo) degradam inferência.
- Dados de gaze podem revelar comportamento sensível de navegação.
- Projetos com pessoas reais devem considerar LGPD/GDPR conforme contexto.
