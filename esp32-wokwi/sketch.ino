#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASS = "";

const char* API_BASE_URL = "https://airport-project-10ho.onrender.com";
const char* API_HOST = "airport-project-10ho.onrender.com";
const uint16_t API_PORT = 443;
const char* DEVICE_ID = "esp32-wokwi-001";
const char* FIRMWARE_VERSION = "v1.1.0";

const unsigned long READ_INTERVAL_MS = 5000;
const unsigned long HEARTBEAT_INTERVAL_MS = 60000;
const unsigned long HEALTH_CHECK_INTERVAL_MS = 60000;
const unsigned long WIFI_RETRY_DELAY_MS = 500;

const float TEMP_DELTA_THRESHOLD = 0.6;
const float HUMIDITY_DELTA_THRESHOLD = 2.5;
const float GAS_DELTA_THRESHOLD = 800.0;
const float PRESSURE_DELTA_THRESHOLD = 1.0;

Adafruit_BME680 bme;

struct Reading {
  float temperature;
  float humidity;
  float pressure;
  float gas;
  float vocIndex;
  float airQualityScore;
};

bool hasLastSent = false;
Reading lastSent = {};

Reading bufferSum = {};
int bufferCount = 0;

unsigned long lastReadAt = 0;
unsigned long lastHeartbeatAt = 0;
unsigned long lastHealthCheckAt = 0;

void connectWiFi();
void runConnectivityDiagnostics();
bool initSensor();
void warmupSensor();
bool readSensor(Reading& out);
float calculateVocIndex(float gasResistance);
float calculateAirQualityScore(float vocIndex, float humidity);
bool detectUrgency(const Reading& r);
bool significantChange(const Reading& current, const Reading& previous);
void addToBuffer(const Reading& r);
Reading buildAverageFromBuffer();
void clearBuffer();
bool sendHealthCheck();
bool sendReading(const Reading& r, bool isHeartbeat, bool isUrgent);
void printHealthFields(const String& body);
void logReading(const char* eventName, const Reading& r, bool urgent);

void setup() {
  Serial.begin(115200);
  delay(300);

  connectWiFi();
  runConnectivityDiagnostics();

  if (!initSensor()) {
    Serial.println("Falha ao inicializar BME680");
    while (true) {
      delay(1000);
    }
  }

  warmupSensor();

  lastHeartbeatAt = millis();
  lastHealthCheckAt = 0;

  Serial.println("ESP32 pronto para enviar leituras ao backend FastAPI");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  const unsigned long now = millis();

  if (now - lastHealthCheckAt >= HEALTH_CHECK_INTERVAL_MS) {
    lastHealthCheckAt = now;
    sendHealthCheck();
  }

  if (now - lastReadAt < READ_INTERVAL_MS) {
    return;
  }
  lastReadAt = now;

  Reading current;
  if (!readSensor(current)) {
    Serial.println("Leitura do BME680 falhou");
    return;
  }

  const bool urgent = detectUrgency(current);
  const bool changed = !hasLastSent || significantChange(current, lastSent) || urgent;

  if (changed) {
    const bool sent = sendReading(current, false, urgent);
    if (sent) {
      lastSent = current;
      hasLastSent = true;
      clearBuffer();
      lastHeartbeatAt = now;
      logReading("ENVIADO-ALTERACAO", current, urgent);
    }
    return;
  }

  addToBuffer(current);

  if (now - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS && bufferCount > 0) {
    Reading avg = buildAverageFromBuffer();
    const bool sent = sendReading(avg, true, false);
    if (sent) {
      lastSent = avg;
      hasLastSent = true;
      clearBuffer();
      lastHeartbeatAt = now;
      logReading("ENVIADO-HEARTBEAT", avg, false);
    }
  }
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Conectando Wi-Fi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(WIFI_RETRY_DELAY_MS);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi conectado. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi indisponivel no momento");
  }
}

void runConnectivityDiagnostics() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Diagnostico pulado: Wi-Fi desconectado");
    return;
  }

  IPAddress resolved;
  bool dnsOk = WiFi.hostByName(API_HOST, resolved);
  Serial.print("DNS ");
  Serial.print(API_HOST);
  Serial.print(": ");
  if (dnsOk) {
    Serial.println(resolved);
  } else {
    Serial.println("falhou");
  }

  WiFiClient plainTcp;
  bool tcpOk = plainTcp.connect(API_HOST, API_PORT);
  Serial.print("TCP 443 (sem TLS): ");
  Serial.println(tcpOk ? "ok" : "falhou");
  if (tcpOk) {
    plainTcp.stop();
  }

  WiFiClientSecure tls;
  tls.setInsecure();
  bool tlsOk = tls.connect(API_HOST, API_PORT);
  Serial.print("TLS 443 handshake: ");
  Serial.println(tlsOk ? "ok" : "falhou");
  if (tlsOk) {
    tls.stop();
  }
}

bool initSensor() {
  Wire.begin(21, 22);
  if (!bme.begin()) {
    return false;
  }

  bme.setTemperatureOversampling(BME680_OS_8X);
  bme.setHumidityOversampling(BME680_OS_2X);
  bme.setPressureOversampling(BME680_OS_4X);
  bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
  bme.setGasHeater(320, 150);

  return true;
}

void warmupSensor() {
  Serial.println("Aguardando estabilizacao inicial do BME680...");
  for (int i = 0; i < 5; i++) {
    bme.performReading();
    delay(800);
  }
}

bool readSensor(Reading& out) {
  for (int i = 0; i < 3; i++) {
    if (bme.performReading()) {
      out.temperature = bme.temperature;
      out.humidity = bme.humidity;
      out.pressure = bme.pressure / 100.0F;
      out.gas = bme.gas_resistance;
      out.vocIndex = calculateVocIndex(out.gas);
      out.airQualityScore = calculateAirQualityScore(out.vocIndex, out.humidity);
      return true;
    }
    delay(120);
  }

  return false;
}

float calculateVocIndex(float gasResistance) {
  float normalized = (gasResistance - 5000.0F) / (50000.0F - 5000.0F);
  normalized = constrain(normalized, 0.0F, 1.0F);
  return (1.0F - normalized) * 100.0F;
}

float calculateAirQualityScore(float vocIndex, float humidity) {
  float gasScore = 100.0F - vocIndex;
  float humidityScore = 100.0F - abs(humidity - 60.0F) * 2.0F;
  humidityScore = constrain(humidityScore, 0.0F, 100.0F);

  float score = gasScore * 0.75F + humidityScore * 0.25F;
  return constrain(score, 0.0F, 100.0F);
}

bool detectUrgency(const Reading& r) {
  return (r.vocIndex >= 70.0F && r.humidity >= 78.0F && r.temperature >= 24.0F);
}

bool significantChange(const Reading& current, const Reading& previous) {
  return abs(current.temperature - previous.temperature) >= TEMP_DELTA_THRESHOLD ||
         abs(current.humidity - previous.humidity) >= HUMIDITY_DELTA_THRESHOLD ||
         abs(current.gas - previous.gas) >= GAS_DELTA_THRESHOLD ||
         abs(current.pressure - previous.pressure) >= PRESSURE_DELTA_THRESHOLD;
}

void addToBuffer(const Reading& r) {
  bufferSum.temperature += r.temperature;
  bufferSum.humidity += r.humidity;
  bufferSum.pressure += r.pressure;
  bufferSum.gas += r.gas;
  bufferSum.vocIndex += r.vocIndex;
  bufferSum.airQualityScore += r.airQualityScore;
  bufferCount++;
}

Reading buildAverageFromBuffer() {
  Reading avg = {};
  if (bufferCount <= 0) {
    return avg;
  }

  avg.temperature = bufferSum.temperature / bufferCount;
  avg.humidity = bufferSum.humidity / bufferCount;
  avg.pressure = bufferSum.pressure / bufferCount;
  avg.gas = bufferSum.gas / bufferCount;
  avg.vocIndex = bufferSum.vocIndex / bufferCount;
  avg.airQualityScore = bufferSum.airQualityScore / bufferCount;
  return avg;
}

void clearBuffer() {
  bufferSum = {};
  bufferCount = 0;
}

bool sendHealthCheck() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  const String url = String(API_BASE_URL) + "/api/v1/health";

  if (!http.begin(client, url)) {
    Serial.println("Falha ao iniciar HTTP GET /health");
    return false;
  }

  http.setTimeout(15000);
  http.setConnectTimeout(10000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("Accept", "application/json");
  http.addHeader("User-Agent", "ESP32-AirPort/1.1.0");

  const int statusCode = http.GET();
  const String body = http.getString();

  Serial.print("GET /health status: ");
  Serial.println(statusCode);
  if (statusCode <= 0) {
    Serial.print("GET /health erro HTTPClient: ");
    Serial.println(http.errorToString(statusCode));
  } else {
    Serial.print("GET /health body: ");
    Serial.println(body);
    printHealthFields(body);
  }

  http.end();
  return statusCode >= 200 && statusCode < 300;
}

bool sendReading(const Reading& r, bool isHeartbeat, bool isUrgent) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  const String url = String(API_BASE_URL) + "/api/v1/readings";

  if (!http.begin(client, url)) {
    Serial.println("Falha ao iniciar HTTP POST /readings");
    return false;
  }

  http.setTimeout(15000);
  http.setConnectTimeout(10000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Accept", "application/json");
  http.addHeader("User-Agent", "ESP32-AirPort/1.1.0");

  StaticJsonDocument<640> payload;
  payload["device_id"] = DEVICE_ID;
  payload["temperature_c"] = r.temperature;
  payload["humidity_pct"] = r.humidity;
  payload["pressure_hpa"] = r.pressure;
  payload["gas_resistance_ohm"] = r.gas;
  payload["voc_index"] = r.vocIndex;
  payload["air_quality_score"] = r.airQualityScore;
  payload["is_urgent"] = isUrgent;
  payload["is_heartbeat"] = isHeartbeat;

  JsonObject meta = payload["metadata"].to<JsonObject>();
  meta["source"] = "wokwi";
  meta["firmware"] = FIRMWARE_VERSION;
  meta["sensor"] = "bme680";
  meta["wifi_rssi_dbm"] = WiFi.RSSI();

  String body;
  serializeJson(payload, body);

  const int statusCode = http.POST(body);
  const String responseBody = http.getString();

  Serial.print("POST /readings status: ");
  Serial.println(statusCode);
  if (statusCode <= 0) {
    Serial.print("POST /readings erro HTTPClient: ");
    Serial.println(http.errorToString(statusCode));
  } else {
    Serial.print("POST /readings body: ");
    Serial.println(responseBody);

    if (statusCode == 503) {
      Serial.println("API acessivel, mas banco InfluxDB indisponivel no backend.");
    }
  }

  http.end();
  return statusCode >= 200 && statusCode < 300;
}

void printHealthFields(const String& body) {
  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.print("JSON parse /health falhou: ");
    Serial.println(err.c_str());
    return;
  }

  Serial.print("health.api = ");
  Serial.println(doc["api"] | "n/a");
  Serial.print("health.influxdb = ");
  Serial.println(doc["influxdb"] | "n/a");
  Serial.print("health.timestamp = ");
  Serial.println(doc["timestamp"] | "n/a");
}

void logReading(const char* eventName, const Reading& r, bool urgent) {
  Serial.print("[");
  Serial.print(eventName);
  Serial.print("] T=");
  Serial.print(r.temperature, 2);
  Serial.print("C H=");
  Serial.print(r.humidity, 2);
  Serial.print("% P=");
  Serial.print(r.pressure, 1);
  Serial.print("hPa G=");
  Serial.print(r.gas, 0);
  Serial.print("ohm VOC=");
  Serial.print(r.vocIndex, 1);
  Serial.print(" AQ=");
  Serial.print(r.airQualityScore, 1);
  Serial.print(" urgent=");
  Serial.println(urgent ? "true" : "false");
}
