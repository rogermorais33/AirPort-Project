#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>

#ifndef WOKWI_SIM
#include <esp_camera.h>
#endif

#include "config.h"

#ifdef WOKWI_SIM
static const char* TEST_WIFI_SSID = "Wokwi-GUEST";
static const char* TEST_WIFI_PASSWORD = "";
#else
static const char* TEST_WIFI_SSID = WIFI_SSID;
static const char* TEST_WIFI_PASSWORD = WIFI_PASSWORD;
#endif

#ifndef WOKWI_SIM
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
#endif

bool beginHttpClient(HTTPClient& http, const String& url) {
  if (url.startsWith("https://")) {
    static WiFiClientSecure secure_client;
    secure_client.setInsecure();
    return http.begin(secure_client, url);
  }

  static WiFiClient plain_client;
  return http.begin(plain_client, url);
}

bool initCamera() {
#ifdef WOKWI_SIM
  Serial.println("[api-test] WOKWI_SIM enabled: camera capture is mocked");
  return true;
#else
  esp_camera_deinit();

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
    config.jpeg_quality = 12;
    config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_LATEST;
  } else {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 14;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  Serial.printf(
      "[api-test] cfg psram=%s xclk=%u fb_count=%d quality=%d pins(xclk=%d,sda=%d,scl=%d,pclk=%d,vsync=%d,href=%d,pwdn=%d)\n",
      has_psram ? "yes" : "no", config.xclk_freq_hz, config.fb_count, config.jpeg_quality,
      config.pin_xclk, config.pin_sccb_sda, config.pin_sccb_scl, config.pin_pclk, config.pin_vsync,
      config.pin_href, config.pin_pwdn);

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[api-test] camera init failed: 0x%x\n", err);
    return false;
  }

  sensor_t* sensor = esp_camera_sensor_get();
  if (sensor != nullptr) {
    sensor->set_framesize(sensor, FRAMESIZE_QVGA);
    sensor->set_quality(sensor, 12);
  }

  return true;
#endif
}

void testHealth() {
  HTTPClient http;
  const String url = String(API_BASE_URL) + "/api/v1/health";
  if (!beginHttpClient(http, url)) {
    Serial.println("[api-test] health begin failed");
    return;
  }

  int status = http.GET();
  String body = http.getString();
  http.end();

  Serial.printf("[api-test] GET /health status=%d\n", status);
  Serial.println(body);
}

void testFrameCapture() {
#ifdef WOKWI_SIM
  Serial.println("[api-test] mock frame captured bytes=16384");
  return;
#else
  camera_fb_t* fb = esp_camera_fb_get();
  if (fb == nullptr) {
    Serial.println("[api-test] capture failed");
    return;
  }

  Serial.printf("[api-test] frame captured bytes=%u\n", (unsigned int)fb->len);
  esp_camera_fb_return(fb);
#endif
}

void setup() {
  Serial.begin(115200);
  delay(1200);

  WiFi.mode(WIFI_STA);
  WiFi.begin(TEST_WIFI_SSID, TEST_WIFI_PASSWORD);

  Serial.print("[api-test] wifi");
  for (int i = 0; i < 30 && WiFi.status() != WL_CONNECTED; i++) {
    Serial.print('.');
    delay(500);
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[api-test] wifi failed");
    return;
  }

  Serial.print("[api-test] ip=");
  Serial.println(WiFi.localIP());

  if (!initCamera()) {
    Serial.println("[api-test] camera init failed");
    return;
  }

  testHealth();
  testFrameCapture();
}

void loop() {
  delay(10000);
  testHealth();
  testFrameCapture();
}
