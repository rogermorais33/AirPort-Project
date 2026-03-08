# Calibration Workflow

## Meta

Mapear features faciais para coordenadas de gaze usando regressão linear simples.

## Procedimento recomendado

1. Inicie sessão em modo `calibration`.
2. Crie perfil via `/calibration/profile`.
3. Capture 5 pontos (rápido) ou 9 pontos (mais estável).
4. Garanta que cada ponto tenha features recentes (`face_metrics.features`).
5. Treine perfil com `/calibration/{profile_id}/train`.
6. Reavalie no `/live` e no relatório de heatmap.

Observação de API:

- `POST /calibration/{profile_id}/point` aceita `features_json` direto.
- Se `features_json` não for enviado, passe `session_id` para o backend usar as features mais recentes da sessão.

## Dicas de coleta

- Distância estável da câmera.
- Cabeça em posição neutra antes de cada ponto.
- Evitar contra-luz intensa.
- Repetir calibração se mudar resolução/tela/dispositivo.

## Métricas

- `training_error` menor indica melhor ajuste.
- `confidence` de gaze em tempo real depende de erro de treino e detecção de face.
