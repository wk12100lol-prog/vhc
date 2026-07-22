/*
  Vex Hack Coin (VHC) - Miner dla ESP8266
  Wersja: 1.0.0

  Konfiguracja - zmien ponizej:
    WIFI_SSID, WIFI_PASS, WALLET

  Wymagane biblioteki (platformio.ini):
    bblanchon/ArduinoJson @ ^7.0.0

  SHA-256: BearSSL (wbudowany w ESP8266 Arduino core)
  AES-128-CBC: implementacja wlasna (bez zewnetrznych bibliotek)
*/

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <ArduinoJson.h>
#include <bearssl/bearssl.h>

// ============================================================
// KONFIGURACJA
// ============================================================
// === PLACEHOLDERY DLA WEB FLASHER (32+63+35 B + null) ===
const char* WIFI_SSID     = "S_______________________________";
const char* WIFI_PASS     = "P______________________________________________________________";
const char* WALLET        = "W__________________________________";
const char* API_BASE      = "https://vexcoin.xo.je/api";
const unsigned long PING_INTERVAL = 30000;  // ms

// ============================================================
// AES-128-CBC przez BearSSL (br_aes_big_cbcdec)
// ============================================================
bool aes_cbc_decrypt(const uint8_t* key, const uint8_t* iv,
                     const uint8_t* input, int inputLen,
                     uint8_t* output, int* outputLen) {
  if (inputLen % 16 != 0 || inputLen < 16) return false;

  br_aes_big_cbcdec_keys ctx;
  br_aes_big_cbcdec_init(&ctx, key, 16);

  uint8_t myIv[16];
  memcpy(myIv, iv, 16);
  memcpy(output, input, inputLen);

  br_aes_big_cbcdec_run(&ctx, myIv, output, inputLen);

  // Unpad tylko jesli wiecej niz 16 bajtow (zgodnie z slowAES)
  if (inputLen > 16) {
    int padLen = output[inputLen - 1];
    if (padLen < 1 || padLen > 16) return false;
    *outputLen = inputLen - padLen;
  } else {
    *outputLen = inputLen;
  }
  return true;
}

// ============================================================
// SILNIK SHA-256
// ============================================================
class MiningEngine {
public:
  struct Job {
    int blockIndex;
    String prevHash;
    int timestamp;
    String txJson;
    String miner;
    float reward;
    int difficulty;
  };

  static void calcHash(const String& data, uint8_t hash[32]) {
    br_sha256_context ctx;
    br_sha256_init(&ctx);
    br_sha256_update(&ctx, data.c_str(), data.length());
    br_sha256_out(&ctx, hash);
  }

  static bool checkDifficulty(const uint8_t hash[32], int difficulty) {
    // Sprawdz czy hash HEX zaczyna sie od "difficulty" zer
    // (zgodnie z PHP: hash_hex.startswith('0' * difficulty))
    int zeroBytes = difficulty / 2;
    int extraNibbles = difficulty % 2;
    for (int i = 0; i < zeroBytes; i++) {
      if (hash[i] != 0) return false;
    }
    if (extraNibbles > 0) {
      // Gorny nibbel nastepnego bajtu musi byc 0
      if ((hash[zeroBytes] & 0xF0) != 0) return false;
    }
    return true;
  }

  static void hexStr(const uint8_t* data, int len, char* out) {
    static const char hex[] = "0123456789abcdef";
    for (int i = 0; i < len; i++) {
      *out++ = hex[data[i] >> 4];
      *out++ = hex[data[i] & 0x0f];
    }
    *out = 0;
  }

  static bool parseJob(const String& json, Job& job) {
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, json);
    if (err) return false;

    JsonObject j = doc["job"];
    if (j.isNull()) return false;

    job.blockIndex  = j["block_index"] | 0;
    job.prevHash    = j["previous_hash"] | "";
    job.timestamp   = j["timestamp"] | 0;
    job.miner       = j["miner"] | "";
    job.reward      = j["reward"] | 1.0f;
    job.difficulty  = j["difficulty"] | 1;

    JsonArray txs = j["transactions"];
    if (!txs.isNull()) {
      serializeJson(txs, job.txJson);
    } else {
      job.txJson = "[]";
    }
    return true;
  }

  static String buildHeader(const Job& job, int nonce) {
    String h;
    h += String(job.blockIndex);
    h += "|";
    h += job.prevHash;
    h += "|";
    h += String(job.timestamp);
    h += "|";
    h += job.txJson;
    h += "|";
    h += job.miner;
    h += "|";
    h += String((int)job.reward);
    h += "|";
    h += String(job.difficulty);
    h += "|";
    h += String(nonce);
    return h;
  }
};

// ============================================================
// KLIENT HTTP
// ============================================================
class VHCClient {
private:
  String _cookieName, _cookieValue;
  bool _solved;

  // Wykonuje GET przez HTTPS z opcjonalnym ciasteczkiem
  String httpGet(const String& url) {
    std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
    client->setInsecure();
    client->setTimeout(15000);

    HTTPClient https;
    if (!https.begin(*client, url)) return "";

    https.setUserAgent("Mozilla/5.0");
    if (_solved && _cookieName.length() > 0) {
      https.addHeader("Cookie", _cookieName + "=" + _cookieValue);
    }

    int code = https.GET();
    String body;
    if (code > 0) body = https.getString();
    https.end();
    return body;
  }

  // Wykonuje POST przez HTTPS
  String httpPost(const String& url, const String& data) {
    std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
    client->setInsecure();
    client->setTimeout(15000);

    HTTPClient https;
    if (!https.begin(*client, url)) return "";

    https.setUserAgent("Mozilla/5.0");
    https.addHeader("Content-Type", "application/x-www-form-urlencoded");
    if (_solved && _cookieName.length() > 0) {
      https.addHeader("Cookie", _cookieName + "=" + _cookieValue);
    }

    int code = https.POST(data);
    String body;
    if (code > 0) body = https.getString();
    https.end();
    return body;
  }

  bool solveChallenge(const String& html) {
    // Szukamy "toNumbers(" i wyciagamy hex wartosci
    String parts[3];
    int idx = 0;
    int pos = 0;

    while (idx < 3) {
      pos = html.indexOf("toNumbers(\"", pos);
      if (pos < 0) return false;
      pos += 11;  // po "toNumbers("
      // hex string zaczyna sie od razu po cudzyslowie
      int end = html.indexOf("\"", pos);
      if (end < 0) return false;
      parts[idx++] = html.substring(pos, end);
      pos = end + 1;
    }

    String aHex = parts[0];  // key
    String bHex = parts[1];  // IV
    String cHex = parts[2];  // ciphertext

    // Znajdz nazwe ciasteczka
    int cs = html.indexOf("document.cookie=\"");
    if (cs < 0) return false;
    cs += 17;
    int ce = html.indexOf("=", cs);
    if (ce < 0) return false;
    _cookieName = html.substring(cs, ce);

    // Konwertuj hex -> bajty
    uint8_t key[16], iv[16], ct[128];
    int ctLen = hexDecode(cHex, ct, sizeof(ct));
    hexDecode(aHex, key, 16);
    hexDecode(bHex, iv, 16);

    // Odszyfruj
    uint8_t plain[128];
    int plainLen = 0;
    if (!aes_cbc_decrypt(key, iv, ct, ctLen, plain, &plainLen)) {
      Serial.println("[AES] Blad deszyfracji");
      return false;
    }

    // Wynik jako hex (ciasteczko)
    char cookieHex[256];
    MiningEngine::hexStr(plain, plainLen, cookieHex);
    _cookieValue = String(cookieHex);
    _solved = true;

    Serial.print("[AES] Klucz: "); Serial.println(aHex);
    Serial.print("[AES] IV:    "); Serial.println(bHex);
    Serial.print("[AES] CT:    "); Serial.println(cHex);
    Serial.print("[AES] Plain: "); Serial.println(_cookieValue);
    return true;
  }

  static int hexVal(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return 0;
  }

  static int hexDecode(const String& hex, uint8_t* out, int maxLen) {
    int len = hex.length() / 2;
    if (len > maxLen) len = maxLen;
    for (int i = 0; i < len; i++) {
      out[i] = (hexVal(hex[i * 2]) << 4) | hexVal(hex[i * 2 + 1]);
    }
    return len;
  }

public:
  VHCClient() : _solved(false) {}

  bool ensureSession() {
    if (_solved) return true;
    Serial.println("\n--- Challenge anty-bot ---");

    String html = httpGet(String(API_BASE) + "/test.php");
    if (html.length() == 0) {
      Serial.println("[BLAD] Brak odpowiedzi z serwera");
      return false;
    }

    if (html.indexOf("slowAES") < 0 && html.indexOf("aes.js") < 0) {
      Serial.println("[OK] Brak challenge - sesja aktywna");
      _solved = true;
      return true;
    }

    if (solveChallenge(html)) {
      Serial.println("[OK] Challenge rozwiazany!");
      return true;
    }
    Serial.println("[BLAD] Nie udalo sie rozwiazac challenge");
    return false;
  }

  void resetSession() { _solved = false; _cookieName = ""; _cookieValue = ""; }

  bool getJob(MiningEngine::Job& job) {
    String data = "action=get_job&wallet=";
    data += WALLET;
    String resp = httpPost(String(API_BASE) + "/mine.php", data);
    if (resp.length() == 0) return false;

    if (resp.indexOf("\"success\":false") > 0 || resp.indexOf("\"success\": false") > 0) {
      Serial.print("[API] get_job blad: ");
      Serial.println(resp.substring(0, 120));
      return false;
    }

    return MiningEngine::parseJob(resp, job);
  }

  bool submitBlock(const MiningEngine::Job& job, int nonce, const uint8_t hash[32]) {
    char hashHex[65];
    MiningEngine::hexStr(hash, 32, hashHex);

    // Buduj JSON block (bez spacji - zgodnie z PHP json_encode bez JSON_UNESCAPED_UNICODE)
    String blockData = "{";
    blockData += "\"block_index\":"  + String(job.blockIndex) + ",";
    blockData += "\"previous_hash\":\"" + job.prevHash + "\",";
    blockData += "\"timestamp\":"     + String(job.timestamp) + ",";
    blockData += "\"transactions\":"  + job.txJson + ",";
    blockData += "\"miner\":\""       + String(WALLET) + "\",";
    blockData += "\"reward\":1,";
    blockData += "\"difficulty\":"    + String(job.difficulty) + ",";
    blockData += "\"nonce\":"         + String(nonce) + ",";
    blockData += "\"hash\":\""        + String(hashHex) + "\"";
    blockData += "}";

    // URL-encode block
    String encoded;
    for (unsigned int i = 0; i < blockData.length(); i++) {
      char c = blockData.charAt(i);
      if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
        encoded += c;
      } else {
        char buf[4];
        sprintf(buf, "%%%02X", (uint8_t)c);
        encoded += buf;
      }
    }

    String postData = "action=submit_block&block=" + encoded;
    String resp = httpPost(String(API_BASE) + "/mine.php", postData);

    if (resp.indexOf("\"success\":true") >= 0 || resp.indexOf("\"success\": true") >= 0) {
      return true;
    }

    // Wyswietl blad
    int errPos = resp.indexOf("\"error\":\"");
    if (errPos > 0) {
      errPos += 9;
      int errEnd = resp.indexOf("\"", errPos);
      String errMsg = resp.substring(errPos, errEnd);
      Serial.print("[SUBMIT] Blad: ");
      Serial.println(errMsg);
    }
    return false;
  }
};

// ============================================================
// GLOBALNE
// ============================================================
VHCClient client;
unsigned long lastPing = 0;
unsigned long totalHashes = 0;
int blocksFound = 0;
unsigned long startTime = 0;

// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println();
  Serial.println(F("================================="));
  Serial.println(F("  Vex Hack Coin - ESP8266 Miner"));
  Serial.println(F("================================="));

  // --- WiFi ---
  Serial.print(F("[WiFi] Laczenie z "));
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 60) {
    delay(500);
    Serial.print(F("."));
    attempts++;
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("[BLAD] Nie polaczono z WiFi. Reset za 10s..."));
    delay(10000);
    ESP.restart();
    return;
  }

  Serial.print(F("[WiFi] OK! IP: "));
  Serial.println(WiFi.localIP());

  // --- Challenge anty-bot ---
  if (!client.ensureSession()) {
    Serial.println(F("[BLAD] Sesja nieudana. Reset za 10s..."));
    delay(10000);
    ESP.restart();
    return;
  }

  startTime = millis();
  Serial.println(F("\n[VHC] Koparka gotowa do pracy!"));
}

// ============================================================
// LOOP
// ============================================================
void loop() {
  // Sprawdz WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("[WiFi] Rozlaczono! Reset..."));
    delay(1000);
    ESP.restart();
    return;
  }

  // Pobierz zadanie
  Serial.print(F("[VHC] Pobieranie zadania... "));
  MiningEngine::Job job;
  if (!client.getJob(job)) {
    Serial.println(F("BLAD"));
    // Moze ciasteczko wygaslo - odswiez sesje
    client.resetSession();
    if (!client.ensureSession()) {
      delay(10000);
      ESP.restart();
    }
    delay(2000);
    return;
  }
  Serial.print(F("blok #"));
  Serial.print(job.blockIndex);
  Serial.print(F(", trudnosc "));
  Serial.println(job.difficulty);

  // Kopanie
  int nonce = 0;
  bool found = false;

  while (!found) {
    String header = MiningEngine::buildHeader(job, nonce);
    uint8_t hash[32];
    MiningEngine::calcHash(header, hash);
    totalHashes++;

    if (MiningEngine::checkDifficulty(hash, job.difficulty)) {
      // Sukces!
      char hashHex[65];
      MiningEngine::hexStr(hash, 32, hashHex);

      Serial.println(F("\n==============================="));
      Serial.print(F("[BLOK] ZNALEZIONY! nonce="));
      Serial.println(nonce);
      Serial.print(F("[BLOK] Hash: "));
      Serial.println(hashHex);
      Serial.print(F("[BLOK] Trudnosc: "));
      Serial.println(job.difficulty);
      Serial.print(F("[BLOK] Wysylanie... "));

      if (client.submitBlock(job, nonce, hash)) {
        Serial.println(F("ZAAKCEPTOWANY!"));
        blocksFound++;
      } else {
        Serial.println(F("ODRZUCONY!"));
      }
      Serial.println(F("===============================\n"));
      found = true;
      break;
    }

    nonce++;

    // Yield co 100 hashy - zapobiega WDT reset
    if (nonce % 100 == 0) {
      yield();
    }

    // Statystyki co PING_INTERVAL
    unsigned long now = millis();
    if (now - lastPing >= PING_INTERVAL) {
      lastPing = now;
      float elapsed = (now - startTime) / 1000.0f;
      float hr = (elapsed > 0) ? totalHashes / elapsed : 0;
      Serial.print(F("[VHC] hashe:"));
      Serial.print(totalHashes);
      Serial.print(F(" | "));
      Serial.print(hr / 1000.0f, 1);
      Serial.print(F(" kH/s | bloki:"));
      Serial.println(blocksFound);
    }
  }
}
