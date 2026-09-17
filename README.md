# SnipeHelper für Die Stämme

Ein moderner, deutschsprachiger Timing-Helfer für das manuelle Snipen in **Die Stämme**.

> Das Script berechnet und visualisiert den Absendezeitpunkt und sendet nur nach bewusster Scharfschaltung automatisch.

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
- Synchronisation auf 1 Sekunde vorher, gleichzeitig oder 1 Sekunde später
- bewusst schaltbares Auto-Senden mit Abbruchmöglichkeit
- separate Sekundeneingabe für iPhone und andere mobile Browser
- einstellbarer Sendeausgleich gegen Treffer knapp vor dem Sekundenwechsel
- native Die-Stämme-Optik mit bündigen Eingabefeldern
- plausible vorausgefüllte Ankunftszeit ohne gespeicherten Wert
- kompakte relative Ankunft in einer Reihe
- einklappbare laufende Angriffe und erweiterte Einstellungen
- Countdown und Scharf-Status direkt im Browser-Tab
- kompakte Bereitschaftsansicht nach dem Scharfschalten
- sichere Zielzeit-Synchronisierung zwischen mehreren Tabs
- Übersicht aller verbundenen Tabs mit Dorf, Ziel, Versatz, Absendezeit und Status

## Installation in der Schnellleiste

Den folgenden vollständigen Code als Schnellleisten-Script eintragen:

```javascript
javascript:(async function(){const r="8k9fgd7kf7-art/SnipeHelper",b="releases/snipe-helper-v2.2.0.js";let f=b;window.SNIPE_HELPER_CONFIG={zielFarbe:"green",warteFarbe:"#ff9933",ohneDatumFarbe:"green",breite:null};try{const x=await fetch("https://raw.githubusercontent.com/"+r+"/main/latest.json?t="+Date.now(),{cache:"no-store"});if(!x.ok)throw new Error();const m=await x.json();if(m&&/^releases\/snipe-helper-v\d+\.\d+\.\d+\.js$/.test(m.file))f=m.file}catch(e){}$.getScript("https://cdn.jsdelivr.net/gh/"+r+"@main/"+f).fail(function(){window.UI?.ErrorMessage?UI.ErrorMessage("Der Snipe-Helfer konnte nicht geladen werden."):alert("Der Snipe-Helfer konnte nicht geladen werden.")})})();
```

Alternativ steht derselbe Loader lesbar in [loader.js](loader.js). Der Schnellleistencode muss bei künftigen Releases nicht mehr ausgetauscht werden.

## Bedienung

1. Angriff oder Unterstützung bis zur Bestätigungsseite vorbereiten.
2. Den SnipeHelper über die Schnellleiste starten.
3. Die gewünschte Ankunftszeit manuell eintragen oder einen laufenden Befehl aus der eingeblendeten Liste auswählen.
4. Millisekunden und gegebenenfalls eine persönliche Timing-Korrektur einstellen.
5. Auto-Senden bewusst scharfschalten oder zum angezeigten Zeitpunkt manuell bestätigen.

## Mehrere Tabs vorbereiten

1. Den SnipeHelper in allen gewünschten Bestätigungs-Tabs starten.
2. In einem Tab die Zielzeit festlegen.
3. **Verbundene Tabs** öffnen und **Zielzeit an Tabs senden** wählen.
4. Die Zielzeit wird nur von noch nicht scharfgeschalteten Tabs übernommen und passend zur jeweiligen Laufzeit berechnet.
5. Jeden Tab einzeln prüfen und scharfschalten. Bereits scharfe Tabs werden niemals überschrieben.

Der Tab-Verbund funktioniert nur zwischen geöffneten Tabs derselben Spielwelt. Mobile Browser können Hintergrund-Tabs zeitweise anhalten; für mehrere gleichzeitig vorbereitete Angriffe ist deshalb ein Desktop-Browser zuverlässiger.

## Dateien

- `snipe-helper.js` – vollständiges Script
- `loader.js` – dauerhafter, konfigurierbarer Schnellleisten-Loader
- `latest.json` – Verweis auf die aktuell veröffentlichte Release-Datei

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

Aktuell: **2.3.0**
