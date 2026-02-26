# ESP32 Wokwi - Integração com FastAPI

Este diretório contém um projeto pronto para Wokwi usando ESP32 + BME680.

## Arquivos

- `sketch.ino`: firmware completo (BME680 + lógica edge + healthcheck + POST para API).
- `sketch_teste_api.ino`: teste completo da API (diagnóstico + health + post + latest + list), sem sensor.
- `diagram.json`: circuito ESP32 + BME680 via I2C.
- `libraries.txt`: bibliotecas necessárias no Wokwi.

## Como usar no Wokwi

1. Crie um projeto ESP32 no Wokwi.
2. Copie os arquivos deste diretório para o projeto Wokwi.
3. No `sketch.ino`, altere:

```cpp
const char* API_BASE_URL = "https://SEU-ENDERECO-DA-API";
const char* API_HOST = "SEU-ENDERECO-DA-API";
```

Exemplo para Render:

```cpp
const char* API_BASE_URL = "https://airport-project-10ho.onrender.com";
const char* API_HOST = "airport-project-10ho.onrender.com";
```

4. Se estiver rodando local, exponha com ngrok:

```bash
ngrok http 8000
```

5. Cole a URL HTTPS pública do ngrok nas constantes `API_BASE_URL` e `API_HOST`.
6. Rode a simulação no Wokwi e acompanhe os envios no Serial Monitor.

## Lógica Edge implementada

- Leitura periódica do BME680.
- Se houver mudança relevante (delta) ou urgência, envia imediatamente.
- Se estável, acumula em buffer e envia média no heartbeat.
- Flag de urgência (`is_urgent`) quando VOC alto e umidade alta.

## Compatibilidade com backend

Payload enviado é compatível com `POST /api/v1/readings` da pasta `backend-fastapi/`.

## Teste completo sem sensor

Para validar ponta a ponta ESP32 -> API:

1. Abra `sketch_teste_api.ino` no Wokwi.
2. Rode a simulacao.
3. O sketch executa um ciclo automatico com:
   - Diagnostico DNS/TCP/TLS
   - `GET /api/v1/health`
   - `POST /api/v1/readings`
   - `GET /api/v1/readings/latest`
   - `GET /api/v1/readings`

Se vier `4xx/5xx`, confira URL do ngrok, API no ar e token/config do backend.
Se vier `status: -1`, veja o texto `erro HTTPClient` no monitor serial (DNS/TLS/conexao).
