# ESP32 Wokwi - Integração com FastAPI

Este diretório está preparado para simular no VS Code com Wokwi usando PlatformIO.

## Arquivos principais

- `platformio.ini`: configura build local do firmware.
- `wokwi.toml`: aponta para o firmware compilado usado na simulação.
- `src/main_api_test.cpp`: entrada de build para `sketch_teste_api.ino`.
- `src/main_sensor.cpp`: entrada de build para `sketch.ino`.
- `diagram.json`: circuito ESP32 + BME680 via I2C.
- `sketch_teste_api.ino`: teste de conectividade ponta a ponta com API (padrão).
- `sketch.ino`: firmware com leitura do BME680 e lógica edge.

## Fluxo recomendado no VS Code

1. Instale as extensões:
   - `Wokwi Simulator`
   - `PlatformIO IDE`
2. Abra a pasta `esp32-wokwi` no VS Code.
3. Compile o firmware padrão (teste de API):

```bash
pio run -e esp32-api-test
```

Ou use a task do VS Code: `PIO: Build (API Test)`.

4. Rode `Wokwi: Start Simulation`.

Se o build concluir, os binários existirão em:

- `.pio/build/esp32-api-test/firmware.bin`
- `.pio/build/esp32-api-test/firmware.elf`

e o erro `firmware binary ... not found` desaparece.

## Teste de API (padrão)

O sketch `sketch_teste_api.ino` já usa:

```cpp
const char* API_BASE_URL = "https://airport-project-10ho.onrender.com";
const char* API_HOST = "airport-project-10ho.onrender.com";
```

Na simulação, ele executa ciclos de:

- Diagnóstico DNS/TCP/TLS
- `GET /api/v1/health`
- `POST /api/v1/readings`
- `GET /api/v1/readings/latest`
- `GET /api/v1/readings`

## Como usar o firmware com sensor (`sketch.ino`)

1. Compile outra env:

```bash
pio run -e esp32-sensor
```

Ou use a task: `PIO: Build (Sensor)`.

2. Troque temporariamente os caminhos no `wokwi.toml` para:

```toml
firmware = '.pio/build/esp32-sensor/firmware.bin'
elf = '.pio/build/esp32-sensor/firmware.elf'
```

3. Inicie a simulação novamente.

## Troubleshooting

- `status: -1` no serial: falha de rede/DNS/TLS.
- `4xx/5xx`: backend respondeu com erro; validar API online e configuração.
- `firmware binary not found`: rode o `pio run` da env correta antes de iniciar o Wokwi.

### Erro `Unknown development platform 'espressif32'`

Esse erro geralmente indica cache/instalação corrompida do PlatformIO Core. No terminal:

```bash
pio system prune -f
rm -rf ~/.platformio/platforms/espressif32 ~/.platformio/platforms/platform-espressif32
rm -rf ~/.platformio/.cache
pio pkg install -g -p "platformio/espressif32@~6.12.0"
pio run -d esp32-wokwi -e esp32-api-test
```

Se estiver no Windows nativo (não WSL), o caminho equivalente é:
`C:\Users\<seu-usuario>\.platformio\...`
