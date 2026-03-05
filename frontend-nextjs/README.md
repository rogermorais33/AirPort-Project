# Frontend Dashboard (Next.js + Tailwind + shadcn/ui)

Dashboard visual completo para o AirPort Project, consumindo os endpoints FastAPI:

- `GET /api/v1/health`
- `GET /api/v1/readings/latest?device_id=...`
- `GET /api/v1/readings?device_id=...&minutes=...&limit=...`
- `WS /api/v1/ws/readings?device_id=...`

## Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- shadcn/ui
- Recharts

## Como rodar

1. Entre na pasta:

```bash
cd frontend-nextjs
```

2. Instale as dependências:

```bash
npm install
```

3. Configure ambiente:

```bash
cp .env.example .env.local
```

4. Rode em desenvolvimento:

```bash
npm run dev
```

5. Abra:

- http://localhost:3000

## Integração com backend

Por padrão o frontend chama o proxy interno em `/api/proxy/v1/*`.
Esse proxy redireciona para `BACKEND_API_BASE_URL` e evita problemas de CORS no navegador.

Para tempo real via WebSocket, configure:

- `NEXT_PUBLIC_BACKEND_WS_BASE_URL=ws://localhost:8000` (local)
- `NEXT_PUBLIC_BACKEND_WS_BASE_URL=wss://<seu-servico>.onrender.com` (produção Render)

## Estratégia WebSocket em produção

- Reconexão automática com `exponential backoff + jitter` (evita rajadas de reconnect).
- Heartbeat `ping/pong` para detectar conexão quebrada rapidamente.
- Quando o WebSocket está `connected`, o polling REST entra em modo de baixo consumo.
- Quando o WebSocket cai, o polling REST continua mais frequente para manter o dashboard útil.

## Fluxo de dados do projeto

1. ESP32/BME680 envia leituras para `POST /api/v1/readings`.
2. FastAPI valida e grava no InfluxDB (`air_quality`, bucket configurado).
3. FastAPI também transmite a leitura recém-ingestada em `WS /api/v1/ws/readings`.
4. Dashboard recebe eventos em tempo real via WebSocket e usa REST para carga inicial/sincronização.
5. Frontend monta cards KPI, alertas, gráficos e tabela histórica.
