# GazePilot

Monorepo do projeto **GazePilot — ESP32-CAM Gaze/Head Tracking + Heatmap + Hands-free Commands**.

## Módulos

- `backend-fastapi/`: API FastAPI + PostgreSQL + migrations Alembic + WebSocket live.
- `frontend-nextjs/`: dashboard Next.js (`/live`, `/calibration`, `/sessions`, `/sessions/[id]`).
- `esp32-cam/`: firmware ESP32-CAM (PlatformIO) para captura JPEG e envio de frames.
- `browser-extension/`: bridge opcional para executar comandos no navegador via WS.
- `docs/`: arquitetura, API, firmware, calibração e privacidade.
- `Relatório do Projeto.md`: relatório acadêmico atualizado.
- `Edge Computing.md`: estratégia de edge híbrido.

## Arquitetura resumida

1. ESP32-CAM captura frames e envia em `POST /api/v1/frames`.
2. Backend processa pose/gaze, salva métricas em PostgreSQL e publica eventos via WS.
3. Frontend mostra métricas live e relatórios de heatmap por sessão/página.
4. Engine de comandos dispara `NEXT`, `PREV`, `SCROLL_UP`, `SCROLL_DOWN`.

## Quick start

### 1) Backend + Postgres (docker compose na raiz)

```bash
docker compose up --build
```

Backend disponível em `http://localhost:8000`.

### 2) Frontend

```bash
cd frontend-nextjs
cp .env.example .env.local
npm install
npm run dev
```

Frontend em `http://localhost:3000`.

Opcional (backend local sem Docker):

```bash
cd backend-fastapi
cp .env.example .env
python scripts/download_face_landmarker.py
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3) Firmware

```bash
pio run -d esp32-cam -e esp32-cam
pio run -d esp32-cam -e esp32-cam -t upload
```

Simulação Wokwi:

```bash
python -m platformio run -d esp32-cam -e esp32-wokwi
```
Depois execute `Wokwi: Start Simulator` no VS Code.

Sem `pio` no PATH:

```bash
python -m platformio run -d esp32-cam -e esp32-cam
python -m platformio run -d esp32-cam -e esp32-cam -t upload --upload-port COM5
```

## Comandos úteis (Makefile)

```bash
make backend-test
make frontend-lint
make frontend-build
make firmware-build
make firmware-upload PORT=COM5
make firmware-monitor PORT=COM5
```

## Endpoints principais

- `GET /api/v1/health`
- `POST /api/v1/devices/register`
- `POST /api/v1/devices/heartbeat`
- `GET /api/v1/device-config/{device_id}`
- `GET /api/v1/devices/config/{device_id}` (alias)
- `POST /api/v1/sessions/start`
- `GET /api/v1/sessions/active?device_id=...`
- `POST /api/v1/sessions/{id}/end`
- `POST /api/v1/sessions/{id}/page`
- `POST /api/v1/frames`
- `POST /api/v1/calibration/profile`
- `POST /api/v1/calibration/{profile_id}/point`
- `POST /api/v1/calibration/{profile_id}/train`
- `GET /api/v1/reports/session/{id}`
- `GET /api/v1/reports/session/{id}/heatmap`
- `GET /api/v1/reports/session/{id}/timeline`
- `GET /api/v1/reports/session/{id}/commands`
- `WS /api/v1/ws/live?session_id=...`

## Teste completo com ESP32 físico

1. Suba backend + postgres (`docker compose up --build`).
2. Suba frontend (`npm run dev` em `frontend-nextjs`).
3. Configure `esp32-cam/src/config.h` (`WIFI_*`, `API_BASE_URL` com IP LAN do backend).
4. Flash:
   - `IO0 -> GND`, `RST`, upload.
   - remova `IO0 -> GND`, `RST`.
5. Abra `/live`:
   - registre device;
   - clique em `Attach Active` para sincronizar com a sessão do firmware.
6. Valide no serial:
   - `[wifi] connected`
   - `[session] ...`
   - `[frame] status=202`

## Docs

- [Arquitetura](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Firmware](docs/FIRMWARE.md)
- [Calibração](docs/CALIBRATION.md)
- [Privacidade](docs/PRIVACY.md)
