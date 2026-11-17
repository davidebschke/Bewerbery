# Beispiel-Lebensläufe für die CV-Optimierung

Gestaltete Lebensläufe aus Softwareentwicklung und AI-Engineering mit passenden Stellenanzeigen. Sie
dienen zum manuellen Ausprobieren der CV-Optimierung in der App und als Testdaten für den
DOCX/ODT-Parser (`tests/unit/main/cv/samples.test.ts`).

Alle Personen, Firmen und Kontaktdaten sind **frei erfunden**.

Die Dateien entstehen mit `node scripts/generate-cv-samples.mjs`. Das Skript schreibt jeden
Lebenslauf als OpenDocument-Text und lässt ihn von LibreOffice in `.docx` und `.odt` umwandeln. So
liegen Dateien vor, wie ein Office-Programm sie wirklich speichert. Für das Skript wird LibreOffice
gebraucht, ein anderer Pfad lässt sich über `SOFFICE=<Pfad>` angeben.

## Lebensläufe

| Datei | Profil | Gestaltung | Gut zum Prüfen von |
|---|---|---|---|
| `01-backend-lena-hoffmann` | Senior Backend (Kotlin, Spring, Kafka) | Zweispaltig: farbige Seitenleiste mit Foto, Kontakt und Kenntnissen (Tabelle) | Design-Erhalt bei Tabellen, Bild und fetten Labels („Frameworks: …“) |
| `02-ai-engineer-jonas-weber` | AI Engineer (LLM, RAG, MLOps) | Kontakt in einem Textrahmen rechts oben, viele Kennzahlen | Textrahmen, Warnung bei erfundenen Zahlen (400 Testfragen, 35 %, 15.000) |
| `03-junior-frontend-aylin-demir` | Junior Frontend / Quereinsteigerin (React) | Einspaltig und schlicht, mit Links | Kurzer Lebenslauf; zeigt, dass fehlende Erfahrung nicht erfunden wird |
| `04-ai-lead-michael-brandt-en` | Head of AI Engineering, **englisch**, zwei Seiten | Kopf- und Fußzeile mit Seitenzahl | Sprache bleibt Englisch, Kopf-/Fußzeile bleiben unverändert |
| `05-aenderungen-nachverfolgt` | wie Nr. 3 | enthält eine nachverfolgte Änderung | Ablehnung mit dem Hinweis, Änderungen erst anzunehmen |
| `02-ai-engineer-jonas-weber.pdf` | wie Nr. 2 | PDF | Ablehnung mit Anleitung zur Umwandlung in `.docx` |

Jeden Lebenslauf (außer dem PDF) gibt es als `.docx` und als `.odt`.

## Stellenanzeigen

Den Text der Datei in der App unter „Text der Stellenanzeige“ einfügen oder im Feld „Stellenanzeige“
einer Bewerbung speichern.

| Datei | Stelle |
|---|---|
| `stelle-a-ai-engineer-llm.txt` | AI Engineer LLM-Anwendungen (Gesundheitswesen) |
| `stelle-b-senior-backend-kotlin.txt` | Senior Backend Engineer Kotlin |
| `stelle-c-frontend-react.txt` | Frontend-Entwickler:in React (Junior/Mid) |
| `stelle-d-ml-platform-engineer-en.txt` | ML Platform Engineer (englisch) |

## Empfohlene Kombinationen

| Lebenslauf | Stellenanzeige | Erwartung |
|---|---|---|
| 01 Backend | B Senior Backend Kotlin | Hohe Übereinstimmung schon im Original, Varianten nur leicht besser. Fehlend: z. B. Terraform, Domain-Driven Design |
| 02 AI Engineer | A AI Engineer LLM | Gute Passung. Die Varianten sollten Evaluation und DSGVO-Bezug betonen, ohne Gesundheits-Erfahrung zu erfinden |
| 03 Junior Frontend | C Frontend React | Gute Passung. Next.js, Vitest und Playwright erscheinen als fehlend und dürfen nicht hinzugedichtet werden |
| 04 AI Lead (EN) | D ML Platform (EN) | Sehr gute Passung. Die Varianten bleiben englisch |
| 03 Junior Frontend | A AI Engineer LLM | **Absichtlich unpassend:** niedrige Scores, viele fehlende Keywords. Unter Umständen erscheint „Keine Variante übertrifft das Original“ |
| 01 Backend | D ML Platform (EN) | Sprachmix: Der Lebenslauf ist deutsch, die Anzeige englisch, die Varianten bleiben deutsch |

## Worauf beim Prüfen achten

1. **Design:** Eine gespeicherte Variante in Word bzw. LibreOffice öffnen. Seitenleiste, Foto,
   Farben, Textrahmen sowie Kopf- und Fußzeile müssen unverändert sein. In Word zeigt „Überprüfen →
   Vergleichen“ mit dem Original nur Textänderungen.
2. **Nichts erfunden:** Keine neuen Arbeitgeber, Abschlüsse, Werkzeuge oder Zahlen. Neue Zahlen
   markiert die App mit „Bitte prüfen: … steht nicht im Original.“
3. **Länge:** Ab 15 % mehr Text erscheint ein Layout-Hinweis. Bei Nr. 1 auf Zeilenumbrüche in der
   Seitenleiste achten.
4. **Unverändert:** Namen, Kontaktdaten, Zeiträume und Überschriften bleiben stehen.
