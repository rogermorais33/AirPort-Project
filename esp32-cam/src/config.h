#pragma once

// Wi-Fi credentials (ESP32-CAM supports only 2.4GHz networks)
static const char* WIFI_SSID = "";
static const char* WIFI_PASSWORD = "";

// Backend base URL (http:// or https://)
// Use o IP LAN da máquina que está rodando o backend.
// Exemplo: http://192.168.86.2:8000
// Altere este valor antes do upload do firmware.
// Para Wokwi cloud, localhost/IP LAN não funciona: use URL pública (Render/ngrok/cloudflared).
static const char* API_BASE_URL = "http://192.168.0.100:8000";

// Optional pre-provisioned identifiers.
// If empty, firmware auto-registers via /api/v1/devices/register.
static const char* DEVICE_ID = "";
static const char* DEVICE_KEY = "";

// Session mode used when auto-starting a session.
static const char* SESSION_MODE = "mvp";

// Screen dimensions used by backend gaze mapping.
static const int SCREEN_W = 1366;
static const int SCREEN_H = 768;

// Firmware identifier
static const char* FW_VERSION = "gazepilot-esp32cam-1.0.0";
