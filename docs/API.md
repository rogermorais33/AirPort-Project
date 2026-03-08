# GazePilot API Reference

Base URL: `/api/v1`

## Health

- `GET /health`

Resposta inclui status de API/DB/fila e diagnóstico CV:

- `cv_backend_requested`
- `cv_backend_active`
- `mediapipe_available`
- `mediapipe_model`
- `mediapipe_error`

## Devices

- `POST /devices/register`
  - body: `{ "name": "ESP32-CAM Desk", "fw_version": "gazepilot-esp32cam-1.0.0" }`
  - response: `{ "id", "device_key", ... }`
- `POST /devices/heartbeat`
  - body: `{ "device_id", "device_key", "fw_version" }`
- `GET /device-config/{device_id}`
  - endpoint direto usado pelo firmware.
- `GET /devices/config/{device_id}`
  - alias equivalente para clientes REST.
- `GET /devices/key/{device_key}`
  - resolve metadados do device a partir da chave.
  - response: `{ "id", "device_key", "name", "created_at", "fw_version" }`

## Sessions & Pages

- `POST /sessions/start`
  - body: `{ "device_id", "screen_w", "screen_h", "mode": "mvp|calibration" }`
  - observação: encerra sessão ativa anterior do mesmo device para evitar múltiplas sessões concorrentes.
- `GET /sessions/active?device_id=<uuid>`
  - retorna a sessão ativa atual do device (usado para pareamento dashboard <-> firmware).
- `POST /sessions/{id}/end`
- `POST /sessions/{id}/page`
  - body: `{ "url", "title" }`
- `GET /sessions?limit=50`
- `GET /sessions/{id}`
- `GET /sessions/{id}/pages`
- `GET /sessions/{id}/preview`
  - retorna o último frame da sessão (`image/jpeg`) armazenado em cache de memória.
  - retorna `404` se ainda não houver frame no cache.
  - retorna `503` se o serviço de preview não estiver inicializado.

## Frame Ingest

- `POST /frames` (multipart/form-data)
  - `file`: JPEG
  - `session_id`: UUID
  - `ts`: ISO8601 (opcional)
  - `device_key`: form field (ou `X-Device-Key` header, ou query param)
- response `202`: `{ "status": "accepted", "frame_event_id", "processing_status" }`
- erros comuns:
  - `404 Session not found`
  - `404 Session is inactive` (firmware deve limpar sessão local e reanexar sessão ativa)
  - `403 Session does not belong to this device`
  - `401 Invalid device key`

`processing_status` pode ser `done`, `queued` ou `throttled`.

## Calibration

- `POST /calibration/profile`
- `POST /calibration/{profile_id}/point`
  - body: `target_x`, `target_y` e (`features_json` ou `session_id`)
- `POST /calibration/{profile_id}/train`
- `GET /calibration/profiles/{device_id}`

## Reports

- `GET /reports/session/{id}`
- `GET /reports/session/{id}/heatmap`
- `GET /reports/session/{id}/timeline`
- `GET /reports/session/{id}/commands`

## WebSocket

- `WS /ws/live?session_id=<uuid>`

Eventos:

- `connected`
- `device_status`
- `frame_processed`
- `face_metrics`
- `gaze_point`
- `command_triggered`

Observações:

- `session_id` no query string filtra eventos para a sessão indicada.
- clientes sem `session_id` recebem stream global.
