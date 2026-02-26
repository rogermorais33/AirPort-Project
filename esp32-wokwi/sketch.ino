#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASS = "";
const char* API_URL = "https://SEU-ENDERECO-NGROK.ngrok-free.app/api/v1/readings";

const unsigned long READ_INTERVAL_MS = 5000;
const unsigned long HEARTBEAT_INTERVAL_MS = 60000;

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

void setup() {
  Serial.begin(115200);
  delay(300);

  Wire.begin(21, 22);

  if (!bme.begin()) {
    Serial.println("Falha ao inicializar BME680");
    while (true) {
      delay(1000);
    }
  }

  bme.setTemperatureOversampling(BME680_OS_8X);
  bme.setHumidityOversampling(BME680_OS_2X);
  bme.setPressureOversampling(BME680_OS_4X);
  bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
  bme.setGasHeater(320, 150);

  connectWiFi();
  lastHeartbeatAt = millis();

  Serial.println("ESP32 pronto para enviar leituras ao backend FastAPI");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  unsigned long now = millis();
  if (now - lastReadAt < READ_INTERVAL_MS) {
    return;
  }
  lastReadAt = now;

  Reading current;
  if (!readSensor(current)) {
    Serial.println("Leitura do BME680 falhou");
    return;
  }

  bool urgent = detectUrgency(current);
  bool changed = !hasLastSent || significantChange(current, lastSent) || urgent;

  if (changed) {
    bool sent = sendReading(current, false, urgent);
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
    bool sent = sendReading(avg, true, false);
    if (sent) {
      lastSent = avg;
      hasLastSent = true;
      clearBuffer();
      lastHeartbeatAt = now;
      logReading("ENVIADO-HEARTBEAT", avg, false);
    }
  }
}

bool readSensor(Reading& out) {
  if (!bme.performReading()) {
    return false;
  }

  out.temperature = bme.temperature;
  out.humidity = bme.humidity;
  out.pressure = bme.pressure / 100.0F;
  out.gas = bme.gas_resistance;
  out.vocIndex = calculateVocIndex(out.gas);
  out.airQualityScore = calculateAirQualityScore(out.vocIndex, out.humidity);

  return true;
}

float calculateVocIndex(float gasResistance) {
  float normalized = (gasResistance - 5000.0) / (50000.0 - 5000.0);
  normalized = constrain(normalized, 0.0, 1.0);
  return (1.0 - normalized) * 100.0;
}

float calculateAirQualityScore(float vocIndex, float humidity) {
  float gasScore = 100.0 - vocIndex;
  float humidityScore = 100.0 - abs(humidity - 60.0) * 2.0;
  humidityScore = constrain(humidityScore, 0.0, 100.0);

  float score = gasScore * 0.75 + humidityScore * 0.25;
  return constrain(score, 0.0, 100.0);
}

bool detectUrgency(const Reading& r) {
  return (r.vocIndex >= 70.0 && r.humidity >= 78.0 && r.temperature >= 24.0);
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
  Reading avg;
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

bool sendReading(const Reading& r, bool isHeartbeat, bool isUrgent) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");

  JsonDocument payload;
  payload["device_id"] = "esp32-wokwi-001";
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
  meta["firmware"] = "v1.0.0";
  meta["sensor"] = "bme680";

  String body;
  serializeJson(payload, body);

  int statusCode = http.POST(body);
  String responseBody = http.getString();
  http.end();

  Serial.print("POST status: ");
  Serial.println(statusCode);
  Serial.println(responseBody);

  return statusCode >= 200 && statusCode < 300;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Conectando Wi-Fi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
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

void logReading(const char* eventName, const Reading& r, bool urgent) {
  Serial.print("[");
  Serial.print(eventName);
  Serial.print("] T=");
  Serial.print(r.temperature, 2);
  Serial.print("C H=");
  Serial.print(r.humidity, 2);
  Serial.print("% G=");
  Serial.print(r.gas, 0);
  Serial.print("ohm VOC=");
  Serial.print(r.vocIndex, 1);
  Serial.print(" AQ=");
  Serial.print(r.airQualityScore, 1);
  Serial.print(" urgent=");
  Serial.println(urgent ? "true" : "false");
}
