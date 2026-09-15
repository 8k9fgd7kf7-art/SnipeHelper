# SnipeHelper für Die Stämme

Ein moderner, deutschsprachiger Timing-Helfer für das manuelle Snipen in **Die Stämme**.

> Das Script berechnet und visualisiert den Absendezeitpunkt. Es sendet keinen Angriff automatisch.

## Funktionen

- deutsche, responsive Oberfläche für Desktop und Handy
- Zielzeit mit separaten Millisekunden
- positive oder negative Timing-Korrektur
- Anzeige der effektiven Ankunftszeit
- Berechnung der Absendezeit aus der tatsächlichen Laufzeit
- genauer Live-Countdown und Millisekundenbalken
- Übernahme der Ankunftszeit aus laufenden Befehlen
- weltbezogene Speicherung der Einstellungen
- Schutz vor doppeltem Start und mehrfachen Ereignis-Listenern
- verständliche Status- und Fehlermeldungen

## Installation in der Schnellleiste

Den folgenden vollständigen Code als Schnellleisten-Script eintragen:

```javascript
javascript:window.SNIPE_HELPER_CONFIG={zielFarbe:"green",warteFarbe:"#ff9933",ohneDatumFarbe:"green",breite:null};$.getScript("https://cdn.jsdelivr.net/gh/8k9fgd7kf7-art/SnipeHelper@main/snipe-helper.js?v=2.0.1").fail(function(){window.UI?.ErrorMessage?UI.ErrorMessage("Der Snipe-Helfer konnte nicht geladen werden."):alert("Der Snipe-Helfer konnte nicht geladen werden.")});
```

Alternativ steht derselbe Loader lesbar in [loader.js](loader.js).

## Bedienung

1. Angriff oder Unterstützung bis zur Bestätigungsseite vorbereiten.
2. Den SnipeHelper über die Schnellleiste starten.
3. Die gewünschte Ankunftszeit manuell eintragen oder einen laufenden Befehl aus der eingeblendeten Liste auswählen.
4. Millisekunden und gegebenenfalls eine persönliche Timing-Korrektur einstellen.
5. Den normalen Bestätigen-Button zum angezeigten Zeitpunkt selbst betätigen.

## Dateien

- `snipe-helper.js` – vollständiges Script
- `loader.js` – konfigurierbarer Schnellleisten-Loader

## Optionale Farben und Breite

Die Werte werden im Loader vor dem Laden des Scripts gesetzt:

```javascript
window.SNIPE_HELPER_CONFIG = {
    zielFarbe: "green",
    warteFarbe: "#ff9933",
    ohneDatumFarbe: "green",
    breite: null
};
```

Bei `breite: null` passt sich die Oberfläche automatisch an. Alternativ kann eine Breite in Pixeln angegeben werden.

## Version

Aktuell: **2.0.1**
