# ESP32 Wokwi - Integração com FastAPI

Projeto ESP32 para simulação no Wokwi com build local via PlatformIO.

## Arquivos principais

- `sketch_teste_api.ino`: teste de conectividade ponta a ponta (sem sensor físico).
- `sketch.ino`: firmware com leitura do BME680 e lógica edge.
- `platformio.ini`: ambientes de build (`esp32-api-test` e `esp32-sensor`).
- `wokwi.toml`: firmware/ELF usados pelo simulador Wokwi.
- `src/main_api_test.cpp`: entrada de build para `sketch_teste_api.ino`.
- `src/main_sensor.cpp`: entrada de build para `sketch.ino`.
- `diagram.json`: circuito ESP32 + BME680 (I2C).

## Pré-requisitos (VS Code)

- extensão `Wokwi Simulator`
- extensão `PlatformIO IDE`
- comando `pio` disponível no PATH

## Build e simulação (fluxo padrão)

No root do repositório:

```bash
pio run -d esp32-wokwi -e esp32-api-test
```

Depois execute no VS Code:

- `Wokwi: Start Simulation`

O `wokwi.toml` já aponta para:

- `.pio/build/esp32-api-test/firmware.bin`
- `.pio/build/esp32-api-test/firmware.elf`

## Saída serial

`Serial.print`/`Serial.println` aparece no monitor serial do Wokwi (painel da simulação), não no terminal bash comum.

## Teste de API (padrão)

`sketch_teste_api.ino` executa ciclos com:

- diagnóstico DNS/TCP/TLS
- `GET /api/v1/health`
- `POST /api/v1/readings`
- `GET /api/v1/readings/latest`
- `GET /api/v1/readings`

URL atualmente configurada no sketch de teste:

```cpp
const char* API_BASE_URL = "https://airport-project-10ho.onrender.com";
const char* API_HOST = "airport-project-10ho.onrender.com";
```

## Rodar firmware com sensor (`sketch.ino`)

Compile:

```bash
pio run -d esp32-wokwi -e esp32-sensor
```

Troque temporariamente o `wokwi.toml` para:

```toml
firmware = '.pio/build/esp32-sensor/firmware.bin'
elf = '.pio/build/esp32-sensor/firmware.elf'
```

Inicie a simulação novamente.

## Tasks prontas no VS Code

Arquivo: `.vscode/tasks.json`

- `PIO: Build (API Test)`
- `PIO: Build (Sensor)`

## Troubleshooting

- `firmware binary ... not found`
  - rode o build da env correta (`pio run -d esp32-wokwi -e ...`) antes de iniciar o Wokwi.
- `Unknown development platform 'espressif32'`
  - limpar cache e reinstalar plataforma:

```bash
pio system prune -f
rm -rf ~/.platformio/platforms/espressif32 ~/.platformio/platforms/platform-espressif32
rm -rf ~/.platformio/.cache
pio pkg install -g -p "platformio/espressif32@~6.12.0"
```

- `status: -1` no serial
  - falha de DNS/TLS/rede.
- `4xx/5xx` da API
  - backend indisponível, URL incorreta ou erro de configuração no servidor.
