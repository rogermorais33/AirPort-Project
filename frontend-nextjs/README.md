# frontend-nextjs (GazePilot)

Dashboard Next.js para monitoramento live de pose/gaze, calibração e relatórios de sessão com heatmap.

## Rotas

- `/live`: métricas em tempo real (yaw/pitch/roll), status da sessão e command log.
- `/calibration`: wizard de 5/9 pontos com treino de regressão linear.
- `/sessions`: listagem de sessões.
- `/sessions/[id]`: relatório da sessão (summary + heatmap + timeline + commands).

Na tela `/live` existe:
- **Quick Start**: registra device + inicia sessão MVP em 1 clique.
- **Attach Active**: vincula o dashboard à sessão ativa já aberta pelo firmware.

## Stack

- Next.js 14 (App Router)
- React + TypeScript
- Tailwind CSS
- shadcn/ui base components

## Ambiente

Copie:

```bash
cp .env.example .env.local
```

Variáveis importantes:

- `BACKEND_API_BASE_URL`: URL HTTP do backend (usada pelo proxy server-side).
- `NEXT_PUBLIC_DASHBOARD_API_ROOT`: caminho cliente para o proxy (`/api/proxy/v1`).
- `NEXT_PUBLIC_BACKEND_API_BASE_URL`: fallback para resolver WS.
- `NEXT_PUBLIC_BACKEND_WS_BASE_URL`: URL websocket explícita (`ws://` local, `wss://` produção).

## Execução local

```bash
cd frontend-nextjs
npm install
npm run dev
```

Abrir: `http://localhost:3000`

## Integração API

A UI usa proxy interno em `app/api/proxy/[...path]/route.ts` para chamadas REST.

Exemplo:
- `GET /api/proxy/v1/health` -> backend `GET /api/v1/health`

WebSocket conecta direto no backend:
- `WS /api/v1/ws/live?session_id=...`

Health inclui diagnóstico de CV:
- `cv_backend_active`
- `mediapipe_available`

Quando o firmware abre sessão própria, use o botão `Attach Active` em `/live` para sincronizar o dashboard com a sessão ativa do device.

## Build e lint

```bash
npm run lint
npm run build
```

## Deploy no Render

Configuração recomendada (Web Service):

- Root Directory: `frontend-nextjs`
- Build Command: `npm ci && npm run build`
- Start Command: `npm run start -- -H 0.0.0.0 -p $PORT`

Variáveis mínimas:

- `BACKEND_API_BASE_URL=https://<backend>.onrender.com`
- `NEXT_PUBLIC_DASHBOARD_API_ROOT=/api/proxy/v1`
- `NEXT_PUBLIC_BACKEND_WS_BASE_URL=wss://<backend>.onrender.com`
