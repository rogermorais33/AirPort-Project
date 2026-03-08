# backend-fastapi (GazePilot)

API FastAPI do **GazePilot** para ingestão de frames JPEG do ESP32-CAM, extração de pose/cálculo de gaze, geração de comandos hands-free e relatórios (heatmap/timeline).

## Stack

- Python 3.11+
- FastAPI + Uvicorn
- PostgreSQL + SQLAlchemy
- Alembic (migrations)
- OpenCV + MediaPipe Face Landmarker (pipeline CV robusto)
- Redis opcional (modo produção com worker)

## Estrutura

- `app/main.py`: inicialização da API + ciclo de vida.
- `app/api/`: rotas REST e WebSocket.
- `app/models/entities.py`: modelos relacionais (devices/sessions/pages/frames/...)
- `app/services/`: pipeline CV, engine de comandos, queue e ws hub.
- `models/`: artefatos de modelo local (ex.: `face_landmarker.task`).
- `scripts/download_face_landmarker.py`: helper para baixar o modelo do MediaPipe.
- `alembic/`: migrations.
- `tests/`: health, sessions, ingest frame multipart e websocket.

## Endpoints principais

- `GET /api/v1/health`
- `POST /api/v1/devices/register`
- `POST /api/v1/devices/heartbeat`
- `GET /api/v1/device-config/{device_id}`
- `GET /api/v1/devices/config/{device_id}` (alias)
- `GET /api/v1/devices/key/{device_key}`
- `POST /api/v1/sessions/start`
- `GET /api/v1/sessions/active?device_id=...`
- `POST /api/v1/sessions/{id}/end`
- `POST /api/v1/sessions/{id}/page`
- `GET /api/v1/sessions/{id}/pages`
- `GET /api/v1/sessions/{id}/preview` (JPEG do último frame em cache)
- `POST /api/v1/frames` (multipart: `file`, `device_key`, `session_id`, `ts`)
- `POST /api/v1/calibration/profile`
- `POST /api/v1/calibration/{profile_id}/point`
- `POST /api/v1/calibration/{profile_id}/train`
- `GET /api/v1/reports/session/{id}`
- `GET /api/v1/reports/session/{id}/heatmap`
- `GET /api/v1/reports/session/{id}/timeline`
- `GET /api/v1/reports/session/{id}/commands`
- `WS /api/v1/ws/live?session_id=...`

## Rodar local (uv)

```bash
cd backend-fastapi
cp .env.example .env
uv sync
python scripts/download_face_landmarker.py
alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Rodar com Docker Compose (Postgres local)

```bash
cd backend-fastapi
cp .env.example .env
docker compose up --build
```

Serviços:
- `backend` em `http://localhost:8000`
- `postgres` em `localhost:5432`
- `redis` opcional via profile `worker`

Para habilitar Redis + worker:

```bash
docker compose --profile worker up -d redis
```

E rode o worker:

```bash
python -m app.worker
```

## Modo MVP x produção

- **MVP local (sem Redis):** `FRAME_QUEUE_MODE=memory` (ou `sync`) + processamento no backend.
- **Produção:** `FRAME_QUEUE_MODE=redis`, `REDIS_ENABLED=true` e worker separado consumindo `gazepilot:frames`.

## Pareamento Dashboard x Firmware

- O firmware tenta anexar em `GET /api/v1/sessions/active?device_id=...` antes de criar nova sessão.
- `POST /api/v1/sessions/start` encerra sessões ativas anteriores do mesmo device.
- Isso evita múltiplas sessões simultâneas e reduz o cenário de dashboard conectado em sessão errada.
- `POST /api/v1/frames` retorna `404 Session is inactive` para sessão encerrada; o firmware usa isso para limpar `session_id` local e reanexar automaticamente.

## Preview em tempo real

- O backend mantém apenas o último frame por sessão em cache de memória (`FramePreviewStore`).
- O dashboard consome esse frame via `GET /api/v1/sessions/{id}/preview`.
- O cache é efêmero (reinício do container limpa o preview até novos frames chegarem).

## Pipeline CV (MediaPipe + solvePnP)

- Backend `CV_BACKEND=auto` tenta MediaPipe Face Landmarker primeiro.
- Se modelo não existir ou MediaPipe falhar, cai para OpenCV fallback.
- Head pose principal usa `solvePnP` com landmarks faciais.
- Health endpoint mostra diagnóstico do backend CV (`cv_backend_active`, `mediapipe_available`, etc).

Config útil em `.env`:

- `CV_BACKEND=auto|mediapipe|opencv`
- `CV_MEDIAPIPE_MODEL_PATH=models/face_landmarker.task`
- `CV_BLINK_EAR_THRESHOLD=0.19`

## Testes

```bash
cd backend-fastapi
pytest
```

## Deploy Render

1. Criar **PostgreSQL Managed**.
2. Criar **Web Service** apontando para `backend-fastapi`.
3. Variáveis mínimas: `DATABASE_URL`, `FRAME_QUEUE_MODE`, `REDIS_*` (se usar worker), `WS_MAX_CLIENTS`.
4. Start command sugerido:

```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

5. (Opcional) criar segundo serviço Worker com comando:

```bash
python -m app.worker
```
