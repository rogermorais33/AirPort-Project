# Backend FastAPI - AirPort Project

API para receber telemetria de qualidade do ar do ESP32/BME680, salvar no InfluxDB e disponibilizar consulta para dashboard/análise.

## Estrutura

- `app/main.py`: inicialização da API.
- `app/api/readings.py`: endpoints HTTP.
- `app/models/sensor.py`: modelos de entrada e saída.
- `app/services/influx.py`: integração com InfluxDB.
- `pyproject.toml`: dependências e configuração do projeto.
- `uv.lock`: lockfile do `uv`.
- `docker-compose.yml`: sobe InfluxDB + API.

## Pré-requisitos

- Python 3.11+
- `uv` (gerenciador de dependências)
- Docker Compose ou Podman Compose (opcional)

Instalação do `uv` (Linux/macOS):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Desenvolvimento local com uv (recomendado)

1. Entre na pasta do backend:

```bash
cd backend-fastapi
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

3. Instale/sincronize dependências:

```bash
uv sync
```

4. Rode a API:

```bash
uv run uvicorn app.main:app --reload --port 8000
```

5. Rode testes:

```bash
uv run pytest
```

## Gerenciar dependências com uv

Adicionar dependência de runtime:

```bash
uv add nome-da-lib
```

Adicionar dependência de desenvolvimento:

```bash
uv add --dev nome-da-lib
```

Remover dependência:

```bash
uv remove nome-da-lib
```

Atualizar lockfile:

```bash
uv lock
```

Exportar `requirements.txt` (usado no build atual do container):

```bash
uv export --format requirements-txt --no-hashes --output-file requirements.txt
```

## Rodando com Compose

1. Copie `.env.example` para `.env`.
2. Suba os serviços:

```bash
docker compose up --build
```

Ou com Podman:

```bash
podman compose up --build
```

Notas para Podman:

- Você precisa ter `podman-compose` instalado.
- As imagens no `docker-compose.yml` já estão com nome completo (`docker.io/...`) para evitar erro de short-name.

## Endpoints principais

- `GET /api/v1/health`
- `POST /api/v1/readings`
- `GET /api/v1/readings/latest?device_id=esp32-001`
- `GET /api/v1/readings?device_id=esp32-001&minutes=60&limit=200`

## Exemplo de payload para ingestão

```json
{
  "device_id": "esp32-001",
  "timestamp": "2026-02-25T20:10:00Z",
  "temperature_c": 27.3,
  "humidity_pct": 63.2,
  "pressure_hpa": 1009.4,
  "gas_resistance_ohm": 14500.0,
  "voc_index": 35.4,
  "air_quality_score": 71.2,
  "is_urgent": false,
  "is_heartbeat": false,
  "metadata": {
    "source": "wokwi",
    "firmware": "v1.0.0"
  }
}
```

## Observações de produção

- Para acesso público do ESP32 em outra rede, exponha a API com `ngrok`.
- Troque `INFLUX_TOKEN` por token forte.
- Ajuste retenção (`INFLUX_RETENTION_DAYS`) conforme volume esperado.



podman compose down --remove-orphans
podman compose up --build

podman pull docker.io/library/influxdb:2.7
podman compose up --build
