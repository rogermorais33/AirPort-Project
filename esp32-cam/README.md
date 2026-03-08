# esp32-cam (GazePilot Firmware)

Firmware para **ESP32-CAM (AI Thinker)** que captura frames JPEG e envia para o backend GazePilot (`POST /api/v1/frames`).

## Estrutura

- `src/main_camera.cpp`: firmware principal (captura + heartbeat + device config + upload de frames).
- `src/main_api_test.cpp`: sketch de teste rápido (health + captura local).
- `src/config.h`: credenciais Wi-Fi e configuração da API.
- `platformio.ini`: ambientes de build (`esp32-cam`, `esp32-api-test`, `esp32-wokwi`).

## Pré-requisitos

- ESP32-CAM AI Thinker
- Programador USB serial (ESP32-CAM-MB ou FTDI)
- PlatformIO (`pio`) instalado

Para Arduino IDE:

- Pacote `esp32 by Espressif Systems` instalado
- Biblioteca `ArduinoJson` instalada (Library Manager)

Hardware e circuito completos:

- Consulte [`../docs/HARDWARE.md`](../docs/HARDWARE.md) para pinagem, alimentacao, esquema eletrico e procedimento de flash com MB.

## Configuração

Edite `src/config.h`:

- `WIFI_SSID`
- `WIFI_PASSWORD`
- `API_BASE_URL`
- `DEVICE_ID` e `DEVICE_KEY` (opcional; se vazio, firmware registra via API)

Importante:

- ESP32-CAM conecta apenas em **Wi-Fi 2.4GHz**.
- Para teste local, `API_BASE_URL` deve usar IP local do backend (ex.: `http://192.168.86.2:8000`).

## Build

```bash
pio run -d esp32-cam -e esp32-cam
```

Sem `pio` no PATH, use:

```bash
python -m platformio run -d esp32-cam -e esp32-cam
```

Teste API/câmera:

```bash
pio run -d esp32-cam -e esp32-api-test
```

Build para simulação Wokwi (sem câmera real, modo mock):

```bash
pio run -d esp32-cam -e esp32-wokwi
```

## Upload (ESP32-CAM-MB)

1. Conecte o ESP32-CAM ao adaptador MB.
2. Se seu adaptador não entrar em boot automático, faça manual:
   - ligar `IO0 -> GND`
   - pressionar `RST`
3. Execute upload:

```bash
pio run -d esp32-cam -e esp32-cam -t upload
```

4. Após upload, remova `IO0 -> GND` e pressione `RST` para boot normal.

`IO0` é um pino GPIO0 (strap de boot), não o botão lateral.

Monitor serial:

```bash
pio device monitor -b 115200
```

Alternativa:

```bash
python -m platformio device monitor -d esp32-cam -b 115200 --port COM5
```

## Rodar no Wokwi

O Wokwi neste repositório roda via ambiente `esp32-wokwi` com `WOKWI_SIM=1`:

- usa `main_api_test.cpp`;
- simula captura de frame (mock), sem OV2640 real;
- testa conectividade Wi-Fi + `GET /api/v1/health`.

Passos:

1. Compile o firmware da simulação:

```bash
python -m platformio run -d esp32-cam -e esp32-wokwi
```

2. Abra a simulação no VS Code (extensão Wokwi):
   - comando `Wokwi: Start Simulator`.

3. No monitor serial do Wokwi, valide:
   - `[api-test] ip=...`
   - `[api-test] GET /health status=200`
   - `[api-test] mock frame captured bytes=16384`

Importante:

- Wokwi cloud não alcança `localhost`/IP LAN da sua máquina.
- Para testar API no Wokwi, configure `API_BASE_URL` com URL pública (Render/ngrok/cloudflared tunnel).

## Rodar no Arduino IDE

No Arduino IDE, use os wrappers dedicados:

- `arduino-ide/gazepilot_camera/gazepilot_camera.ino`
- `arduino-ide/gazepilot_api_test/gazepilot_api_test.ino`

Passos:

1. Abra um dos arquivos acima no Arduino IDE.
2. Ajuste `src/config.h` (Wi-Fi e `API_BASE_URL`).
3. Selecione a placa `AI Thinker ESP32-CAM`.
4. Faça upload (com procedimento de `IO0 -> GND` se necessário).

Os wrappers reutilizam o mesmo código de `src/`, sem fork de lógica.

## Fluxo do firmware

1. Conecta no Wi-Fi.
2. Sincroniza hora via NTP.
3. Inicializa câmera OV2640.
4. Registra dispositivo (`/devices/register`) se necessário.
5. Busca config (`/device-config/{device_id}`) e inicia sessão (`/sessions/start`).
6. Envia heartbeat (`/devices/heartbeat`) e frames multipart para `/frames`.

Antes de criar sessão, o firmware tenta anexar à sessão ativa do mesmo device (`/sessions/active?device_id=...`).

Se algum passo falhar no boot, o firmware tenta recuperação automática no `loop()` (reconexão Wi-Fi, registro de device e start de sessão).

## Observações

- O envio é feito em JPEG com `multipart/form-data`.
- `fps` e `quality` podem ser ajustados pelo backend via endpoint de config.
- Para produção HTTPS, o firmware usa `WiFiClientSecure` em modo `setInsecure()` (MVP).
- Se o dashboard ficar em sessão diferente, use `Sincronizar Sessão Ativa` na página `/live`.
