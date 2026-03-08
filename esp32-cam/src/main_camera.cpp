#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <cstring>
#include <esp_camera.h>
#include <time.h>
#include <vector>

#include "config.h"

// AI Thinker ESP32-CAM pin map
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22

String g_device_id = DEVICE_ID;
String g_device_key = DEVICE_KEY;
String g_session_id = "";
int g_fps = 6;
int g_jpeg_quality = 10;
bool g_camera_ready = false;

unsigned long g_last_frame_ms = 0;
unsigned long g_last_heartbeat_ms = 0;
unsigned long g_last_config_ms = 0;
unsigned long g_last_recovery_ms = 0;

void deinitCameraBestEffort() {
  // When a previous init attempt fails halfway, driver resources (GPIO ISR) can
  // remain allocated. Deinit before a new init avoids "ISR already installed".
  esp_camera_deinit();
}

bool beginHttpClient(HTTPClient& http, const String& url) {
  if (url.startsWith("https://")) {
    static WiFiClientSecure secure_client;
    secure_client.setInsecure();
    return http.begin(secure_client, url);
  }

  static WiFiClient plain_client;
  return http.begin(plain_client, url);
}

void logHttpFailure(const char* method, const String& url, int status, const String& body) {
  if (status <= 0) {
    Serial.printf("[http] %s %s status=%d err=%s\n", method, url.c_str(), status,
                  HTTPClient::errorToString(status).c_str());
  } else {
    Serial.printf("[http] %s %s status=%d\n", method, url.c_str(), status);
  }

  if (body.length() > 0) {
    Serial.println(body);
  }
}

String isoTimestampUtc() {
  time_t now;
  time(&now);

  struct tm time_info;
  gmtime_r(&now, &time_info);

  char output[32];
  strftime(output, sizeof(output), "%Y-%m-%dT%H:%M:%SZ", &time_info);
  return String(output);
}

bool connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("[wifi] connecting");
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[wifi] failed");
    return false;
  }

  Serial.print("[wifi] connected ip=");
  Serial.println(WiFi.localIP());
  return true;
}

void syncClock() {
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  Serial.println("[time] syncing NTP");
  for (int i = 0; i < 20; i++) {
    time_t now;
    time(&now);
    if (now > 100000) {
      Serial.println("[time] synced");
      return;
    }
    delay(300);
  }
  Serial.println("[time] sync timeout, using local fallback");
}

bool initCamera() {
  deinitCameraBestEffort();

  const bool has_psram = psramFound();
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;

  if (has_psram) {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = g_jpeg_quality;
    config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_LATEST;
  } else {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = max(12, g_jpeg_quality);
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  Serial.printf(
      "[camera] cfg psram=%s xclk=%u fb_count=%d quality=%d pins(xclk=%d,sda=%d,scl=%d,pclk=%d,vsync=%d,href=%d,pwdn=%d)\n",
      has_psram ? "yes" : "no", config.xclk_freq_hz, config.fb_count, config.jpeg_quality,
      config.pin_xclk, config.pin_sccb_sda, config.pin_sccb_scl, config.pin_pclk, config.pin_vsync,
      config.pin_href, config.pin_pwdn);

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[camera] init failed: 0x%x\n", err);
    return false;
  }

  sensor_t* sensor = esp_camera_sensor_get();
  if (sensor != nullptr) {
    sensor->set_framesize(sensor, FRAMESIZE_QVGA);
    sensor->set_quality(sensor, g_jpeg_quality);
  }

  Serial.println("[camera] initialized");
  return true;
}

bool postJson(const String& endpoint, const String& payload, JsonDocument& out_doc) {
  HTTPClient http;
  const String url = String(API_BASE_URL) + endpoint;
  if (!beginHttpClient(http, url)) {
    Serial.printf("[http] POST begin failed url=%s\n", url.c_str());
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  int status = http.POST(payload);
  String body = http.getString();
  http.end();

  if (status < 200 || status >= 300) {
    logHttpFailure("POST", url, status, body);
    return false;
  }

  DeserializationError err = deserializeJson(out_doc, body);
  if (err) {
    Serial.printf("[json] parse fail: %s\n", err.c_str());
    return false;
  }

  return true;
}

bool getJson(const String& endpoint, JsonDocument& out_doc) {
  HTTPClient http;
  const String url = String(API_BASE_URL) + endpoint;
  if (!beginHttpClient(http, url)) {
    Serial.printf("[http] GET begin failed url=%s\n", url.c_str());
    return false;
  }

  int status = http.GET();
  String body = http.getString();
  http.end();

  if (status < 200 || status >= 300) {
    logHttpFailure("GET", url, status, body);
    return false;
  }

  DeserializationError err = deserializeJson(out_doc, body);
  if (err) {
    Serial.printf("[json] parse fail: %s\n", err.c_str());
    return false;
  }

  return true;
}

bool ensureDevice() {
  if (g_device_id.length() > 0 && g_device_key.length() > 0) {
    Serial.println("[device] using configured DEVICE_ID/DEVICE_KEY");
    return true;
  }

  JsonDocument request_doc;
  request_doc["name"] = "ESP32-CAM";
  request_doc["fw_version"] = FW_VERSION;

  String payload;
  serializeJson(request_doc, payload);

  JsonDocument response_doc;
  if (!postJson("/api/v1/devices/register", payload, response_doc)) {
    return false;
  }

  g_device_id = String((const char*)response_doc["id"]);
  g_device_key = String((const char*)response_doc["device_key"]);

  Serial.print("[device] id=");
  Serial.println(g_device_id);
  Serial.print("[device] key=");
  Serial.println(g_device_key);

  return g_device_id.length() > 0 && g_device_key.length() > 0;
}

bool startSession() {
  if (g_device_id.length() == 0) {
    return false;
  }

  JsonDocument request_doc;
  request_doc["device_id"] = g_device_id;
  request_doc["screen_w"] = SCREEN_W;
  request_doc["screen_h"] = SCREEN_H;
  request_doc["mode"] = SESSION_MODE;

  String payload;
  serializeJson(request_doc, payload);

  JsonDocument response_doc;
  if (!postJson("/api/v1/sessions/start", payload, response_doc)) {
    return false;
  }

  g_session_id = String((const char*)response_doc["session"]["id"]);

  Serial.print("[session] id=");
  Serial.println(g_session_id);
  return g_session_id.length() > 0;
}

bool attachActiveSession() {
  if (g_device_id.length() == 0) {
    return false;
  }

  JsonDocument response_doc;
  if (!getJson("/api/v1/sessions/active?device_id=" + g_device_id, response_doc)) {
    return false;
  }

  const char* session_id = response_doc["id"] | nullptr;
  if (session_id == nullptr || strlen(session_id) == 0) {
    return false;
  }

  g_session_id = String(session_id);
  Serial.print("[session] attached active id=");
  Serial.println(g_session_id);
  return true;
}

bool ensureSessionBound() {
  if (g_session_id.length() > 0) {
    return true;
  }

  // Prefer reusing current backend session so dashboard and firmware stay aligned.
  if (attachActiveSession()) {
    return true;
  }

  // Fallback: create a new session when no active one exists.
  return startSession();
}

void sendHeartbeat() {
  if (g_device_id.length() == 0 || g_device_key.length() == 0) {
    return;
  }

  JsonDocument request_doc;
  request_doc["device_id"] = g_device_id;
  request_doc["device_key"] = g_device_key;
  request_doc["fw_version"] = FW_VERSION;

  String payload;
  serializeJson(request_doc, payload);

  JsonDocument response_doc;
  if (postJson("/api/v1/devices/heartbeat", payload, response_doc)) {
    Serial.println("[heartbeat] ok");
  }
}

void fetchDeviceConfig() {
  if (g_device_id.length() == 0) {
    return;
  }

  JsonDocument response_doc;
  if (!getJson("/api/v1/device-config/" + g_device_id, response_doc)) {
    return;
  }

  g_fps = max(1, (int)response_doc["fps"] | g_fps);
  g_jpeg_quality = max(5, (int)response_doc["quality"] | g_jpeg_quality);

  sensor_t* sensor = esp_camera_sensor_get();
  if (sensor != nullptr) {
    sensor->set_quality(sensor, g_jpeg_quality);
  }

  Serial.printf("[config] fps=%d quality=%d\n", g_fps, g_jpeg_quality);
}

bool sendFrame() {
  if (g_session_id.length() == 0 || g_device_key.length() == 0) {
    return false;
  }

  camera_fb_t* fb = esp_camera_fb_get();
  if (fb == nullptr) {
    Serial.println("[frame] capture failed");
    return false;
  }

  const String boundary = "----gazepilot-boundary";
  const String ts = isoTimestampUtc();

  String body_head;
  body_head.reserve(256);
  body_head += "--" + boundary + "\r\n";
  body_head += "Content-Disposition: form-data; name=\"device_key\"\r\n\r\n" + g_device_key + "\r\n";
  body_head += "--" + boundary + "\r\n";
  body_head += "Content-Disposition: form-data; name=\"session_id\"\r\n\r\n" + g_session_id + "\r\n";
  body_head += "--" + boundary + "\r\n";
  body_head += "Content-Disposition: form-data; name=\"ts\"\r\n\r\n" + ts + "\r\n";
  body_head += "--" + boundary + "\r\n";
  body_head += "Content-Disposition: form-data; name=\"file\"; filename=\"frame.jpg\"\r\n";
  body_head += "Content-Type: image/jpeg\r\n\r\n";

  const String body_tail = "\r\n--" + boundary + "--\r\n";

  const size_t total_size = body_head.length() + fb->len + body_tail.length();
  std::vector<uint8_t> payload;
  payload.resize(total_size);

  size_t offset = 0;
  memcpy(payload.data() + offset, body_head.c_str(), body_head.length());
  offset += body_head.length();
  memcpy(payload.data() + offset, fb->buf, fb->len);
  offset += fb->len;
  memcpy(payload.data() + offset, body_tail.c_str(), body_tail.length());

  HTTPClient http;
  const String url = String(API_BASE_URL) + "/api/v1/frames";
  bool started = beginHttpClient(http, url);
  if (!started) {
    Serial.printf("[http] POST begin failed url=%s\n", url.c_str());
    esp_camera_fb_return(fb);
    return false;
  }

  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
  http.addHeader("X-Device-Key", g_device_key);

  int status = http.POST(payload.data(), payload.size());
  String response = http.getString();
  http.end();

  esp_camera_fb_return(fb);

  Serial.printf("[frame] status=%d size=%u\n", status, (unsigned int)payload.size());
  if (status < 200 || status >= 300) {
    if (status == 401) {
      Serial.println("[frame] auth failed, resetting device credentials");
      g_device_id = "";
      g_device_key = "";
      g_session_id = "";
    } else if (status == 403 || status == 404) {
      Serial.println("[frame] session invalid, resetting session");
      g_session_id = "";
    }
    logHttpFailure("POST", url, status, response);
    return false;
  }

  return true;
}

void setup() {
  Serial.begin(115200);
  delay(1200);

  if (connectWifi()) {
    syncClock();
  } else {
    Serial.println("[setup] wifi not ready, loop() will retry");
  }

  g_camera_ready = initCamera();
  if (!g_camera_ready) {
    Serial.println("[setup] camera not ready, loop() will retry");
  }

  if (g_camera_ready && ensureDevice()) {
    fetchDeviceConfig();
    if (ensureSessionBound()) {
      sendHeartbeat();
      Serial.println("[setup] ready");
    } else {
      Serial.println("[setup] session start failed, loop() will retry");
    }
  } else {
    Serial.println("[setup] device bootstrap pending");
  }
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    if (connectWifi()) {
      syncClock();
    }
    delay(200);
    return;
  }

  const unsigned long now = millis();

  if (!g_camera_ready) {
    if (now - g_last_recovery_ms >= 5000UL) {
      Serial.println("[recovery] trying camera init");
      g_camera_ready = initCamera();
      g_last_recovery_ms = now;
    }
    delay(50);
    return;
  }

  if (g_device_id.length() == 0 || g_device_key.length() == 0) {
    if (now - g_last_recovery_ms >= 5000UL) {
      Serial.println("[recovery] trying device register");
      if (!ensureDevice()) {
        g_last_recovery_ms = now;
        delay(50);
        return;
      }
      fetchDeviceConfig();
      g_last_recovery_ms = now;
    }
    delay(50);
    return;
  }

  if (g_session_id.length() == 0) {
    if (now - g_last_recovery_ms >= 5000UL) {
      Serial.println("[recovery] trying session attach/start");
      ensureSessionBound();
      g_last_recovery_ms = now;
    }
    delay(50);
    return;
  }

  if (now - g_last_config_ms >= 60000UL) {
    fetchDeviceConfig();
    g_last_config_ms = now;
  }

  if (now - g_last_heartbeat_ms >= 20000UL) {
    sendHeartbeat();
    g_last_heartbeat_ms = now;
  }

  const unsigned long frame_interval_ms = 1000UL / (unsigned long)max(1, g_fps);
  if (now - g_last_frame_ms >= frame_interval_ms) {
    sendFrame();
    g_last_frame_ms = now;
  }

  delay(5);
}
