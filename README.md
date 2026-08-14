# St. Markus – Zeitschriftenreihe

Statische Website für die Zeitschrift des St. Antonius Klosters in Kröffelbach. Beiträge werden als lesbare HTML-Seiten ausgegeben; die PDFs bleiben als Original-Download erhalten.

## Lokale Aktualisierung

Neue PDF-Dateien in dieses Verzeichnis legen und anschließend ausführen:

```bash
npm run build
```

Das Skript liest die Inhaltsverzeichnisse und erzeugt `assets/issues.js`, die HTML-Beitragsseiten unter `articles/` sowie passende Bilder aus den PDF-Ausgaben unter `assets/article-images/`.

## Veröffentlichung

Das Repository in GitHub anlegen und in **Settings → Pages** die Veröffentlichung aus dem Hauptbranch, Ordner `/ (root)`, aktivieren. Die Datei `CNAME` richtet die gewünschte Domain `markus.kopten.de` ein. Beim DNS-Provider muss `markus` anschließend als CNAME auf `<github-benutzername>.github.io` zeigen.
