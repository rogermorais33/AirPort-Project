#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASS = "";
const char* BASE_URL = "https://unretrieved-jejunely-lizbeth.ngrok-free.dev";
const char* NGROK_HOST = "unretrieved-jejunely-lizbeth.ngrok-free.dev";
const char* DEVICE_ID = "esp32-wokwi-api-test-001";

const unsigned long SEND_INTERVAL_MS = 10000;
unsigned long lastSendAt = 0;

void connectWiFi();
void runConnectivityDiagnostics();
bool testHealth();
void printHealthFields(const String& body);
bool sendTestReading();

void setup() {
  Serial.begin(115200);
  delay(300);

  connectWiFi();
  runConnectivityDiagnostics();

  Serial.println("Teste inicial de conectividade com API");
  testHealth();
  sendTestReading();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  const unsigned long now = millis();
  if (now - lastSendAt >= SEND_INTERVAL_MS) {
    lastSendAt = now;

    Serial.println("\n--- Novo ciclo de teste ---");
    runConnectivityDiagnostics();
    testHealth();
    sendTestReading();
  }
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Conectando no Wi-Fi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
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
  bool dnsOk = WiFi.hostByName(NGROK_HOST, resolved);
  Serial.print("DNS ");
  Serial.print(NGROK_HOST);
  Serial.print(": ");
  if (dnsOk) {
    Serial.println(resolved);
  } else {
    Serial.println("falhou");
  }

  WiFiClientSecure tcp;
  tcp.setInsecure();
  const bool tcpOk = tcp.connect(NGROK_HOST, 443);
  Serial.print("TCP 443: ");
  Serial.println(tcpOk ? "ok" : "falhou");
  if (tcpOk) {
    tcp.stop();
  }
}

bool testHealth() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi indisponivel para GET /health");
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  const String url = String(BASE_URL) + "/api/v1/health";

  if (!http.begin(client, url)) {
    Serial.println("Falha ao iniciar HTTP GET /health");
    return false;
  }

  http.setTimeout(15000);
  http.setConnectTimeout(10000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("Accept", "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent", "ESP32-Wokwi/1.0");

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

void printHealthFields(const String& body) {
  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.print("JSON parse falhou: ");
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

bool sendTestReading() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi indisponivel para POST /readings");
    return false;
  }

  const float temperature = 24.0 + ((millis() / 1000) % 30) * 0.1;
  const float humidity = 55.0 + ((millis() / 1000) % 20) * 0.2;
  const float pressure = 1008.0 + ((millis() / 1000) % 10) * 0.1;
  const float gas = 12000.0 + ((millis() / 1000) % 25) * 100.0;

  StaticJsonDocument<512> doc;
  doc["device_id"] = DEVICE_ID;
  doc["temperature_c"] = temperature;
  doc["humidity_pct"] = humidity;
  doc["pressure_hpa"] = pressure;
  doc["gas_resistance_ohm"] = gas;
  doc["voc_index"] = 35.0;
  doc["air_quality_score"] = 72.0;
  doc["is_urgent"] = false;
  doc["is_heartbeat"] = false;

  JsonObject meta = doc["metadata"].to<JsonObject>();
  meta["source"] = "wokwi-connectivity-test";
  meta["firmware"] = "v1.0.0";

  String payload;
  serializeJson(doc, payload);

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  const String url = String(BASE_URL) + "/api/v1/readings";

  if (!http.begin(client, url)) {
    Serial.println("Falha ao iniciar HTTP POST /readings");
    return false;
  }

  http.setTimeout(15000);
  http.setConnectTimeout(10000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent", "ESP32-Wokwi/1.0");

  const int statusCode = http.POST(payload);
  const String body = http.getString();

  Serial.print("POST /readings status: ");
  Serial.println(statusCode);
  if (statusCode <= 0) {
    Serial.print("POST /readings erro HTTPClient: ");
    Serial.println(http.errorToString(statusCode));
  } else {
    Serial.print("POST /readings body: ");
    Serial.println(body);
  }

  http.end();

  return statusCode >= 200 && statusCode < 300;
}
