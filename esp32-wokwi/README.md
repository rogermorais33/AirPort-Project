# ESP32 Wokwi - Integração com FastAPI

Este diretório contém um projeto pronto para Wokwi usando ESP32 + BME680.

## Arquivos

- `sketch.ino`: firmware com leitura do sensor, lógica edge (delta/heartbeat) e POST para API.
- `sketch_teste_api.ino`: teste rápido de conectividade com API (sem sensor).
- `diagram.json`: circuito ESP32 + BME680 via I2C.
- `libraries.txt`: bibliotecas necessárias no Wokwi.

## Como usar no Wokwi

1. Crie um projeto ESP32 no Wokwi.
2. Copie os arquivos deste diretório para o projeto Wokwi.
3. No `sketch.ino`, altere:

```cpp
const char* API_URL = "https://SEU-ENDERECO-NGROK.ngrok-free.app/api/v1/readings";
```

4. Inicie sua API local e exponha com ngrok:

```bash
ngrok http 8000
```

5. Cole a URL HTTPS pública do ngrok em `API_URL`.
6. Rode a simulação no Wokwi e acompanhe os envios no Serial Monitor.

## Lógica Edge implementada

- Leitura periódica do BME680.
- Se houver mudança relevante (delta) ou urgência, envia imediatamente.
- Se estável, acumula em buffer e envia média no heartbeat.
- Flag de urgência (`is_urgent`) quando VOC alto e umidade alta.

## Compatibilidade com backend

Payload enviado é compatível com `POST /api/v1/readings` da pasta `backend-fastapi/`.

## Teste rapido sem sensor

Para validar somente a conexao ESP32 -> API:

1. Abra `sketch_teste_api.ino` no Wokwi.
2. Rode a simulacao.
3. Veja no Serial Monitor:
   - `GET /health status: 200`
   - `POST /readings status: 201` (ou outro 2xx)

Se vier `4xx/5xx`, confira URL do ngrok, API no ar e token/config do backend.
Se vier `status: -1`, veja o texto `erro HTTPClient` no monitor serial (DNS/TLS/conexao).
