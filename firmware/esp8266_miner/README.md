# Vex Hack Coin - ESP8266 Miner

Firmware koparki VHC na ESP8266 (NodeMCU, Wemos D1 Mini, itp).

## Wymagania

### Hardware
- ESP8266 (NodeMCU v3, Wemos D1 Mini, lub inny z minimum 4MB flash)
- Kabel USB do programowania
- Stabilne zasilanie (zalecany zasilacz 5V/1A, nie USB z komputera)
- (Opcjonalnie) Radiator na ESP8266 przy dluższym kopaniu

### Software
- [PlatformIO IDE](https://platformio.org/) (zalecany) lub Arduino IDE
- Pakiety PlatformIO: `espressif8266`, `ArduinoJson`

## Instalacja (PlatformIO)

1. Otwórz folder `firmware/esp8266_miner` w PlatformIO
2. Edytuj `src/main.cpp` - ustaw swoją sieć WiFi i adres portfela:
   ```cpp
   const char* WIFI_SSID     = "MOJA_SIEC";
   const char* WIFI_PASS     = "MOJE_HASLO";
   const char* WALLET        = "VHC...";  // z panelu vexcoin.xo.je
   ```
3. Podłącz ESP8266 przez USB
4. Kliknij "Upload and Monitor"

## Instalacja (Arduino IDE)

1. Zainstuj board ESP8266 w Arduino IDE (Menedżer płytek -> URL: `http://arduino.esp8266.com/stable/package_esp8266com_index.json`)
2. Zainstaluj bibliotekę `ArduinoJson` (przez Menedżer bibliotek)
3. Otwórz `esp8266_miner.ino`
4. Edytuj konfigurację (WiFi, portfel)
5. Wybierz płytkę NodeMCU 1.0 (ESP-12E) i port COM
6. Kliknij "Wgraj"

## Pierwsze uruchomienie

Po wgraniu i podłączeniu:
1. Otwórz Monitor Portu (115200 baud)
2. ESP8266 połączy się z WiFi
3. Rozwiąże challenge anty-bot (AES)
4. Rozpocznie kopanie

## Wydajność

- ESP8266 @ 80 MHz: ~10-20 kH/s
- ESP8266 @ 160 MHz: ~20-30 kH/s
- Blok co ~30-90 minut (przy trudności 4-6)

**Uwaga:** ESP8266 ma znacznie mniejszą moc niż CPU/GPU. Nie oczekuj takich samych wyników jak na PC. To bardziej demonstracja/config proof-of-concept.

## Struktura plików

```
esp8266_miner/
  platformio.ini     - konfiguracja PlatformIO
  esp8266_miner.ino  - kod źródłowy (Arduino IDE)
  src/
    main.cpp         - kod źródłowy (PlatformIO)
  README.md          - ta instrukcja
```
