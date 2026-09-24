---
paths:
  - "**/*"
---

# Dokumentationspflicht

- Nach **jedem codetechnischen Commit** (also jedem Commit, der Quellcode, Konfiguration, Skripte
  oder Tests ändert – nicht bei reinen Doku-Commits) ist verpflichtend der Skill
  `engineering:documentation` auszuführen, um die [README.md](../../README.md) auf den aktuellen
  Stand zu bringen (Beschreibung, Tech-Stack, Projektstruktur, Setup-/Build-/Test-Anleitungen).
- Die README.md ist intern durchgängig zweisprachig gegliedert: zuerst ein vollständiger
  **Deutsch**-Abschnitt, danach derselbe Inhalt als **English**-Abschnitt. Beide Abschnitte müssen
  inhaltlich deckungsgleich bleiben – wird ein Punkt geändert, wird er in beiden Sprachen aktualisiert.
- Pflichtabschnitte in jeder Sprachversion:
  1. Projektbeschreibung
  2. Tech-Stack (als Tabelle: Technologie / Zweck)
  3. Projektstruktur
  4. Anleitung: Projekt in VS Code auschecken und starten
  5. Anleitung: ausführbare Dateien bauen – mit und ohne Docker
  6. Anleitung: Tests ausführen
- Die README.md bleibt die einzige Quelle für diese Punkte; keine Duplikate in weiteren Dateien
  anlegen, stattdessen aus anderen Docs darauf verlinken.
