# Backend FastAPI - AirPort Project

API para receber telemetria de qualidade do ar do ESP32/BME680, salvar no InfluxDB e disponibilizar consulta REST + stream WebSocket para o dashboard.

## Stack

- Python 3.11+
- FastAPI + Uvicorn
- InfluxDB 2.x
- `uv` para gerenciamento de dependências
- `pytest` para testes

## Estrutura

- `app/main.py`: inicialização da aplicação.
- `app/api/readings.py`: endpoints HTTP e WebSocket.
- `app/models/sensor.py`: schemas Pydantic.
- `app/services/influx.py`: escrita e leitura no InfluxDB.
- `app/services/ws.py`: hub WebSocket para broadcast.
- `tests/`: testes de healthcheck e websocket.

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste os valores:

```bash
cp .env.example .env
```

Principais variáveis:

- `APP_NAME`: nome da API.
- `APP_ENV`: ambiente (`dev`, `prod`, etc).
- `APP_PORT`: porta da API (padrão `8000`).
- `INFLUX_URL`: URL do InfluxDB.
- `INFLUX_TOKEN`: token de autenticação do InfluxDB.
- `INFLUX_ORG`: organização do InfluxDB.
- `INFLUX_BUCKET`: bucket de telemetria.
- `INFLUX_RETENTION_DAYS`: retenção (dias) para criação automática do bucket.
- `WS_MAX_CLIENTS`: limite de conexões websocket simultâneas.

## Execução local com uv (recomendado)

```bash
cd backend-fastapi
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

API local: `http://localhost:8000`

## Testes

```bash
cd backend-fastapi
uv run pytest
```

## Execução com Docker Compose

```bash
cd backend-fastapi
cp .env.example .env
docker compose up --build
```

Com Podman:

```bash
cd backend-fastapi
cp .env.example .env
podman compose up --build
```

## Endpoints

- `GET /api/v1/health`
- `POST /api/v1/readings`
- `GET /api/v1/readings/latest?device_id=esp32-wokwi-001`
- `GET /api/v1/readings?device_id=esp32-wokwi-001&minutes=60&limit=200`
- `WS /api/v1/ws/readings?device_id=esp32-wokwi-001`

Comportamentos importantes:

- Se o InfluxDB estiver indisponível, endpoints de leitura/escrita retornam `503`.
- O websocket envia evento inicial `connected`.
- Se houver `device_id` no websocket e já existir dado no banco, envia `latest_snapshot`.
- Em cada ingestão, o websocket envia `reading_ingested` para clientes compatíveis com o filtro de `device_id`.
- Se exceder `WS_MAX_CLIENTS`, a conexão recebe `overloaded` e fecha com código `1013`.

## Exemplo de ingestão

```bash
curl -X POST "http://localhost:8000/api/v1/readings" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id":"esp32-wokwi-001",
    "temperature_c":24.5,
    "humidity_pct":62.3,
    "pressure_hpa":1009.2,
    "gas_resistance_ohm":12400,
    "voc_index":33.8,
    "air_quality_score":77.5,
    "is_urgent":false,
    "is_heartbeat":false,
    "metadata":{"source":"manual-test"}
  }'
```

## Teste de websocket com websocat

```bash
websocat "ws://localhost:8000/api/v1/ws/readings?device_id=esp32-wokwi-001"
```

No terminal do websocat, envie:

```text
ping
```

A API deve responder com um evento `pong`.

## Deploy (Render)

Para usar com o frontend no Render:

1. Suba este serviço como Web Service.
2. Defina variáveis (`INFLUX_*`, `WS_MAX_CLIENTS`, etc).
3. Garanta que `INFLUX_URL` seja acessível pelo serviço.
4. Use a URL pública no frontend como `BACKEND_API_BASE_URL`.

## Troubleshooting

- `503 InfluxDB indisponivel`: validar `INFLUX_URL`, `INFLUX_TOKEN`, conectividade e permissões.
- `404 em /readings/latest`: ainda não há leitura para o `device_id` informado.
- WebSocket fecha com `1013`: limite de `WS_MAX_CLIENTS` atingido.
