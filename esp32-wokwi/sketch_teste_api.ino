#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASS = "";

const char* API_BASE_URL = "https://airport-project-10ho.onrender.com";
const char* API_HOST = "airport-project-10ho.onrender.com";
const uint16_t API_PORT = 443;
const char* DEVICE_ID = "esp32-wokwi-api-test-001";
const char* FIRMWARE_VERSION = "v1.1.0-test";

const unsigned long TEST_CYCLE_INTERVAL_MS = 15000;
const unsigned long WIFI_RETRY_DELAY_MS = 500;

unsigned long lastCycleAt = 0;
uint32_t cycleCounter = 0;

void connectWiFi();
void runConnectivityDiagnostics();
void runFullTestCycle();
int httpGetJson(const String& url, String& responseBody);
int httpPostJson(const String& url, const String& requestBody, String& responseBody);
bool testHealth();
bool sendTestReading();
bool testLatest();
bool testList();
void printHealthFields(const String& body);
String buildTestPayload();

void setup() {
  Serial.begin(115200);
  delay(300);

  connectWiFi();

  Serial.println("Teste completo de conectividade com API");
  runFullTestCycle();
  lastCycleAt = millis();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  const unsigned long now = millis();
  if (now - lastCycleAt >= TEST_CYCLE_INTERVAL_MS) {
    runFullTestCycle();
    lastCycleAt = now;
  }
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Conectando no Wi-Fi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(WIFI_RETRY_DELAY_MS);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Conectado. IP local: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Falha ao conectar no Wi-Fi.");
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

void runFullTestCycle() {
  cycleCounter++;

  Serial.println("\n==============================");
  Serial.print("Ciclo de teste #");
  Serial.println(cycleCounter);
  Serial.println("==============================");

  runConnectivityDiagnostics();

  bool healthOk = testHealth();
  bool postOk = sendTestReading();
  bool latestOk = testLatest();
  bool listOk = testList();

  Serial.println("--- Resumo ciclo ---");
  Serial.print("health: ");
  Serial.println(healthOk ? "ok" : "falhou");
  Serial.print("post: ");
  Serial.println(postOk ? "ok" : "falhou");
  Serial.print("latest: ");
  Serial.println(latestOk ? "ok" : "falhou");
  Serial.print("list: ");
  Serial.println(listOk ? "ok" : "falhou");
}

int httpGetJson(const String& url, String& responseBody) {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, url)) {
    Serial.println("Falha ao iniciar HTTP GET");
    return -1;
  }

  http.setTimeout(15000);
  http.setConnectTimeout(10000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("Accept", "application/json");
  http.addHeader("User-Agent", "ESP32-AirPort-Test/1.1.0");

  int statusCode = http.GET();
  responseBody = http.getString();

  if (statusCode <= 0) {
    Serial.print("HTTP GET erro: ");
    Serial.println(http.errorToString(statusCode));
  }

  http.end();
  return statusCode;
}

int httpPostJson(const String& url, const String& requestBody, String& responseBody) {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, url)) {
    Serial.println("Falha ao iniciar HTTP POST");
    return -1;
  }

  http.setTimeout(15000);
  http.setConnectTimeout(10000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Accept", "application/json");
  http.addHeader("User-Agent", "ESP32-AirPort-Test/1.1.0");

  int statusCode = http.POST(requestBody);
  responseBody = http.getString();

  if (statusCode <= 0) {
    Serial.print("HTTP POST erro: ");
    Serial.println(http.errorToString(statusCode));
  }

  http.end();
  return statusCode;
}

bool testHealth() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi indisponivel para GET /health");
    return false;
  }

  String responseBody;
  const String url = String(API_BASE_URL) + "/api/v1/health";
  int statusCode = httpGetJson(url, responseBody);

  Serial.print("GET /health status: ");
  Serial.println(statusCode);
  Serial.print("GET /health body: ");
  Serial.println(responseBody);

  if (statusCode >= 200 && statusCode < 300) {
    printHealthFields(responseBody);
  }

  return statusCode >= 200 && statusCode < 300;
}

bool sendTestReading() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi indisponivel para POST /readings");
    return false;
  }

  String payload = buildTestPayload();
  String responseBody;
  const String url = String(API_BASE_URL) + "/api/v1/readings";

  int statusCode = httpPostJson(url, payload, responseBody);

  Serial.print("POST /readings status: ");
  Serial.println(statusCode);
  Serial.print("POST /readings body: ");
  Serial.println(responseBody);

  if (statusCode == 503) {
    Serial.println("API acessivel, mas InfluxDB indisponivel no backend.");
  }

  return statusCode >= 200 && statusCode < 300;
}

bool testLatest() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi indisponivel para GET /readings/latest");
    return false;
  }

  String responseBody;
  const String url = String(API_BASE_URL) + "/api/v1/readings/latest?device_id=" + DEVICE_ID;
  int statusCode = httpGetJson(url, responseBody);

  Serial.print("GET /readings/latest status: ");
  Serial.println(statusCode);
  Serial.print("GET /readings/latest body: ");
  Serial.println(responseBody);

  return statusCode >= 200 && statusCode < 300;
}

bool testList() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi indisponivel para GET /readings");
    return false;
  }

  String responseBody;
  const String url = String(API_BASE_URL) + "/api/v1/readings?device_id=" + DEVICE_ID + "&minutes=60&limit=5";
  int statusCode = httpGetJson(url, responseBody);

  Serial.print("GET /readings status: ");
  Serial.println(statusCode);
  Serial.print("GET /readings body: ");
  Serial.println(responseBody);

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

String buildTestPayload() {
  float temperature = 24.0F + ((millis() / 1000) % 25) * 0.15F;
  float humidity = 52.0F + ((millis() / 1000) % 20) * 0.25F;
  float pressure = 1008.0F + ((millis() / 1000) % 10) * 0.12F;
  float gas = 11000.0F + ((millis() / 1000) % 30) * 95.0F;

  StaticJsonDocument<640> doc;
  doc["device_id"] = DEVICE_ID;
  doc["temperature_c"] = temperature;
  doc["humidity_pct"] = humidity;
  doc["pressure_hpa"] = pressure;
  doc["gas_resistance_ohm"] = gas;
  doc["voc_index"] = 35.0F;
  doc["air_quality_score"] = 72.0F;
  doc["is_urgent"] = false;
  doc["is_heartbeat"] = false;

  JsonObject meta = doc["metadata"].to<JsonObject>();
  meta["source"] = "wokwi-connectivity-test";
  meta["firmware"] = FIRMWARE_VERSION;
  meta["cycle"] = cycleCounter;
  meta["wifi_rssi_dbm"] = WiFi.RSSI();

  String payload;
  serializeJson(doc, payload);
  return payload;
}
