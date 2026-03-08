# Firmware Guide (ESP32-CAM)

## Objetivo

Executar captura de frames no ESP32-CAM e publicar no backend GazePilot.

## Arquivo de configuração

`esp32-cam/src/config.h`

- `WIFI_SSID`
- `WIFI_PASSWORD`
- `API_BASE_URL`
- `DEVICE_ID` / `DEVICE_KEY` (opcional)
- `SCREEN_W` / `SCREEN_H`

Observações importantes:

- Use SSID 2.4GHz (ESP32-CAM não conecta em 5GHz).
- `API_BASE_URL` deve ser alcançável pelo ESP na rede local.

## Build e upload

```bash
pio run -d esp32-cam -e esp32-cam
pio run -d esp32-cam -e esp32-cam -t upload
pio device monitor -b 115200
```

Se `pio` não estiver no PATH do Windows:

```bash
python -m platformio run -d esp32-cam -e esp32-cam
python -m platformio run -d esp32-cam -e esp32-cam -t upload --upload-port COM5
python -m platformio device monitor -d esp32-cam -b 115200 --port COM5
```

## Wokwi (simulação)

Ambiente de simulação disponível:

- `esp32-wokwi` (usa `main_api_test.cpp` com `WOKWI_SIM=1`).

Comandos:

```bash
python -m platformio run -d esp32-cam -e esp32-wokwi
```

Depois inicie o simulador no VS Code:

- `Wokwi: Start Simulator`

Limitação:

- não há câmera OV2640 real no Wokwi neste modo; a captura é mock.
- para `GET /health` funcionar no Wokwi cloud, use `API_BASE_URL` pública (Render/ngrok/cloudflared), não `localhost`.

## Arduino IDE

Suporte disponível via wrappers:

- `esp32-cam/sketch.ino` (modo camera principal)
- `esp32-cam/arduino-ide/gazepilot_camera/gazepilot_camera.ino`
- `esp32-cam/arduino-ide/gazepilot_api_test/gazepilot_api_test.ino`

Passos:

1. Instale `esp32 by Espressif Systems` no Boards Manager.
2. Instale `ArduinoJson` no Library Manager.
3. Edite `esp32-cam/src/config.h`.
4. Selecione `AI Thinker ESP32-CAM`.
5. Faça upload com o fluxo de boot (`IO0 -> GND`, `RST`, upload, remover `IO0`, `RST`).

## Flash manual (ESP32-CAM-MB)

1. Ligue `IO0 -> GND` (modo flash).
2. Pressione `RST`.
3. Faça upload com PlatformIO.
4. **Remova** `IO0 -> GND` (modo execução normal).
5. Pressione `RST` novamente.

Obs.: no ESP32-CAM-MB/FTDI, `IO0` é um **pino** (GPIO0), não botão lateral.

## Endpoint usados no firmware

- `POST /api/v1/devices/register`
- `GET /api/v1/device-config/{device_id}`
- `POST /api/v1/sessions/start`
- `POST /api/v1/devices/heartbeat`
- `POST /api/v1/frames`

O firmware possui recuperação automática no loop para reconectar Wi-Fi e refazer registro/sessão quando necessário.
Ao iniciar, ele tenta anexar à sessão ativa do mesmo device (`GET /sessions/active?device_id=...`) antes de criar sessão nova.

## Pareamento com dashboard

Fluxo recomendado:

1. No `/live`, registre o device.
2. Faça upload/reboot do ESP32-CAM.
3. Clique em `Attach Active` (ou inicie sessão MVP no dashboard).
4. Verifique no serial:
   - `[wifi] connected`
   - `[session] attached active id=...` ou `[session] id=...`
   - `[frame] status=202`

Se `frames=0`, normalmente é sessão diferente entre dashboard e firmware. Use `Attach Active`.

## Diagnóstico rápido de upload/porta

- Se aparecer `Please specify upload_port`, informe explicitamente:
  - `--upload-port COM5` (Windows)
  - `--upload-port /dev/ttyUSB0` (Linux)
- Se aparecer `Could not open COMx`:
  - feche monitor serial/Arduino IDE/VS Code que esteja segurando a porta;
  - confirme a porta no Gerenciador de Dispositivos;
  - desconecte e reconecte o adaptador USB serial.

## Limitações práticas

- Iluminação baixa reduz detecção facial.
- JPEG muito alto pode exceder `FRAME_MAX_BYTES`.
- HTTPS em MVP usa `setInsecure()`.
