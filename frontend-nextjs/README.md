# Frontend Dashboard (Next.js + Tailwind + shadcn/ui)

Dashboard web do AirPort Project para visualização de saúde da API, última leitura, histórico e eventos em tempo real.

## Stack

- Next.js 14 (App Router)
- React + TypeScript
- Tailwind CSS
- shadcn/ui
- Recharts

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Executar localmente

```bash
cd frontend-nextjs
cp .env.example .env.local
npm install
npm run dev
```

Abrir: `http://localhost:3000`

## Variáveis de ambiente

Arquivo base: `.env.example`

- `BACKEND_API_BASE_URL`
  URL base da API usada no servidor Next.js (proxy interno). Exemplo: `http://localhost:8000`.
- `NEXT_PUBLIC_DASHBOARD_API_ROOT`
  Caminho usado pelo cliente para chamadas REST. Padrão recomendado: `/api/proxy/v1`.
- `NEXT_PUBLIC_BACKEND_API_BASE_URL`
  URL HTTP pública do backend para uso no cliente (ex.: inferência de URL websocket).
- `NEXT_PUBLIC_BACKEND_WS_BASE_URL`
  URL websocket explícita do backend.
  - Local: `ws://localhost:8000`
  - Produção: `wss://<servico>.onrender.com`
- `NEXT_PUBLIC_DEFAULT_DEVICE_ID`
  Device padrão ao abrir o dashboard.

## Integração com backend

O frontend usa um proxy interno em `app/api/proxy/[...path]/route.ts`.

Exemplo:

- cliente chama `GET /api/proxy/v1/health`
- o Next.js redireciona para `GET ${BACKEND_API_BASE_URL}/api/v1/health`

Benefícios:

- evita CORS no navegador
- centraliza troca de URL do backend por variável de ambiente

Observação importante:

- o proxy atual implementa `GET`.
- WebSocket não passa por `/api/proxy`; conecta direto em `NEXT_PUBLIC_BACKEND_WS_BASE_URL`.

## Endpoints consumidos

- `GET /api/v1/health`
- `GET /api/v1/readings/latest?device_id=...`
- `GET /api/v1/readings?device_id=...&minutes=...&limit=...`
- `WS /api/v1/ws/readings?device_id=...`

## Estratégia de tempo real

- reconexão automática com backoff exponencial + jitter
- heartbeat `ping/pong`
- polling REST reduzido quando websocket está conectado
- fallback para polling mais frequente quando websocket cai

## Deploy no Render

Use **Web Service** (não Static Site), porque o projeto usa rotas server (`/api/proxy`).

Configuração típica:

- Root Directory: `frontend-nextjs`
- Build Command: `npm ci && npm run build`
- Start Command: `npm run start -- -H 0.0.0.0 -p $PORT`

Variáveis mínimas de produção:

- `BACKEND_API_BASE_URL=https://SEU-BACKEND.onrender.com`
- `NEXT_PUBLIC_DASHBOARD_API_ROOT=/api/proxy/v1`
- `NEXT_PUBLIC_BACKEND_API_BASE_URL=https://SEU-BACKEND.onrender.com`
- `NEXT_PUBLIC_BACKEND_WS_BASE_URL=wss://SEU-BACKEND.onrender.com`
- `NEXT_PUBLIC_DEFAULT_DEVICE_ID=esp32-wokwi-001`
