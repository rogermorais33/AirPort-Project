# AirPort Project

Monorepo do projeto AirPort com backend FastAPI, dashboard Next.js e firmware ESP32 (Wokwi) para telemetria de qualidade do ar.

## Estrutura do repositório

- `backend-fastapi/`: API FastAPI com integração InfluxDB.
- `frontend-nextjs/`: dashboard web (Next.js + Tailwind + shadcn/ui).
- `esp32-wokwi/`: firmware ESP32 e simulação Wokwi/PlatformIO.
- `get-platformio.py`: utilitário de bootstrap do PlatformIO Core (opcional, uso local).
- `Relatório do Projeto.md`: documento técnico/acadêmico.
- `Edge Computing.md`: notas sobre estratégia de edge computing.

## Fluxo de dados

1. ESP32 envia telemetria para `POST /api/v1/readings`.
2. Backend valida e grava no InfluxDB.
3. Backend publica evento em `WS /api/v1/ws/readings`.
4. Frontend carrega dados via REST e mantém atualização em tempo real via WebSocket.

## Quick start local

### 1) Backend

```bash
cd backend-fastapi
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

### 2) Frontend

Em outro terminal:

```bash
cd frontend-nextjs
cp .env.example .env.local
npm install
npm run dev
```

Abrir `http://localhost:3000`.

### 3) ESP32 (simulação)

```bash
pio run -d esp32-wokwi -e esp32-api-test
```

Depois, no VS Code: `Wokwi: Start Simulation`.

## Deploy (resumo)

- Backend: Render Web Service para `backend-fastapi`.
- Frontend: Render Web Service para `frontend-nextjs`.
- O frontend deve apontar `BACKEND_API_BASE_URL` para a URL pública do backend.

## Documentação por módulo

- Backend: `backend-fastapi/README.md`
- Frontend: `frontend-nextjs/README.md`
- ESP32/Wokwi: `esp32-wokwi/README.md`

## Referências do projeto

## TLDRAW
https://www.tldraw.com/f/1wUM6W3ITuRcHHfyeofKw?d=v-654.-256.3877.1908.page

## Relatório do Projeto
[Relatório do Projeto](https://github.com/rogermorais33/AirPort-Project/blob/main/Relat%C3%B3rio%20do%20Projeto.md)

## Edge Computing
[Edge Computing](https://github.com/rogermorais33/AirPort-Project/blob/main/Edge%20Computing.md)

## Imagem do Circuito
<img width="700" height="400" alt="image" src="https://github.com/user-attachments/assets/2e2be2ad-f318-4911-83b6-f306e3d3bb18" />
