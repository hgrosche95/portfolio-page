# Portfolio

Meine Bewerbungs-Portfolio-Seite — soll die im Lebenslauf gelisteten Skills
selbst zeigen, nicht nur beschreiben: React/TypeScript-Frontend,
Node-Backend, API-Integration, CI/CD. Die Begründung hinter den
Design-/Tech-Entscheidungen (warum Astro statt Next.js, warum
`is-a.dev`-Domain statt eigener TLD, u. a.) steht in [DECISIONS.md](DECISIONS.md).

Live: https://henrikgrosche.is-a.dev

## Features

- **Interaktive Architektur-Schaltpläne** — jede Projektseite zeigt den
  Aufbau des Projekts als Schaltplan; Abläufe (z. B. „Faktenfrage mit
  Quellen") lassen sich abspielen, ein Klick auf eine Komponente erklärt
  sie. Beim Build als SVG erzeugt, ohne React und ohne JS-Bundle.
- **Hero mit echtem KI-System** — der Encounter-Agent aus dem Agentic
  Roguelike, umschaltbar zwischen Cloud-Modell und eigenem Fine-Tune.
- **Projekt-Index** auf der Startseite — aufklappbare Zeilen mit Art,
  Live-Status, Stack, Mini-Schaltplan und der wichtigsten
  Architekturentscheidung; funktioniert ohne JavaScript (`<details>`).
- **Entscheidungen als Randnotizen** — pro Projekt die verworfenen Optionen,
  die gewählte Lösung und die Begründung, strukturiert im Frontmatter.
- **Live-CI/CD-Pipeline-Visualisierung** — zieht echte Daten aus dem letzten
  eigenen GitHub-Actions-Deploy (Commit, Status, Zeitpunkt) und spielt sie
  bei jedem Seitenaufruf als Animation ab.
- **Live-GitHub-Daten pro Projekt** — letzter Commit, Sprache; nicht
  hardcodiert.
- **Tag-Filter für den Projekt-Index** — aus den echten Tech-Stack-Daten
  abgeleitet (nur Tags, die bei mindestens zwei Projekten vorkommen, sonst
  wäre es kein Filter, sondern nur eine Umbenennung eines Links).
- **Erreichbarkeits-Check für Live-Demos mit Scale-to-Zero-Backend**
  (`great_galguti_game`, `ai-trip-planer`): schläft der Container gerade,
  zeigt die Seite das an, statt dass der erste Klick nach 30–40 s wie ein
  kaputtes Deployment aussieht.
- **Kontaktformular** über eine eigene Azure Function (Versand via Brevo),
  mit Honeypot-Feld und Rate-Limiting statt eines simplen `mailto:`-Links.
- Dark Mode per Default mit Light-Toggle, Impressum/Datenschutz.

## Projektstruktur

```
src/
├── pages/            Astro-Routen: index, projects/[slug], impressum, datenschutz, 404
├── content/projects/ Ein MDX-Dokument pro Projekt (Text, Tech-Stack, Schaltplan-Daten, Entscheidungen)
├── components/       Astro-Komponenten (u. a. Schematic, ProjectIndex) + die React-Insel DeployPipeline
├── lib/              Reine Logik ohne DOM, z. B. die Schaltplan-Geometrie (schematic.ts)
├── data/             Generierte JSON-Daten (GitHub-Stats, Deploy-Info) — siehe scripts/
└── layouts/, styles/

scripts/              Läuft vor jedem dev/build (predev/prebuild): GitHub-Stats
                      holen, Deploy-Info erzeugen, OG-Bilder rendern (satori + sharp)

api/                  Eigenständige Azure-Functions-App (eigenes package.json):
                      Kontaktformular (contact.ts) und Live-Status-Check (live-status.ts)
```

Projekte werden als MDX-Datei unter `src/content/projects/` hinzugefügt —
Titel, Tech-Stack, optionaler Schaltplan mit Abläufen, Entscheidungen und optionale Live-Demo
kommen komplett aus dem Frontmatter (siehe `src/content.config.ts`), keine
Komponente muss dafür angefasst werden.

## Stack

| Bereich | Wahl | Warum |
|---|---|---|
| Framework | Astro 7 + React-Islands | Die meisten Seiten (About, Timeline, Projekt-Texte) sind statisch — React wird nur für das CI/CD-Widget geladen statt für die ganze Seite hydriert. Details: DECISIONS.md. |
| Styling | Tailwind 4 | Utility-first; Farben und Schriften als Design-Tokens in `global.css` („Schaltplan"-Look). |
| Content | MDX + Astro Content Collections | Projekt-Texte als Markdown mit typisiertem Frontmatter (Zod-Schema, inkl. Querverweis-Prüfung für Schaltpläne). |
| Schaltpläne | eigene Geometrie + statisches SVG | Layout und Leitungspfade in `src/lib/schematic.ts`, zur Build-Zeit berechnet; kein Diagramm-Framework im Browser. |
| CI/CD-Widget | `@xyflow/react` | Fertige Flow-Graph-Bibliothek statt Eigenbau. |
| API | Azure Functions (Node/TypeScript) | Passt zum Static-Web-Apps-Deployment: läuft im selben Free-Tier-Deployment mit, ohne eigenen Server. |
| Testing | Vitest | Für Frontend (`schematic.test.ts`) und API (`contact.test.ts`, `live-status.test.ts`) getrennt. |
| Hosting | Azure Static Web Apps, Free-Tier | Kostenlos für statischen Astro-Output; liefert außerdem die echten Deploy-Daten für die CI/CD-Visualisierung. |

## Entwicklung

Voraussetzung: Node.js ≥ 23.6.

```bash
npm install
npm run dev      # Astro-Dev-Server, meist http://localhost:4321
npm test         # Vitest
```

`npm run dev`/`npm run build` holen vorher automatisch (via `predev`/`prebuild`)
frische GitHub-Stats, generieren die Deploy-Info-Daten und rendern die
OG-Bilder — kein manueller Zwischenschritt nötig.

Die API liegt als eigenständiges Node-Projekt in `api/` und braucht die
[Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local):

```bash
cd api
npm install
npm start        # func start
npm test         # Vitest
```

Lokal ungesetzte Umgebungsvariablen (`BREVO_API_KEY`, `CONTACT_TO_EMAIL`,
`CONTACT_FROM_EMAIL`) lassen das Kontaktformular fehlschlagen, ohne den Rest
der Seite zu beeinträchtigen.

## Deployment

Jeder Push auf `main` läuft über
`.github/workflows/azure-static-web-apps-agreeable-tree-0f9b1f60f.yml`:
installiert und testet Frontend und `api/` getrennt, baut dann beides und
deployed nach Azure Static Web Apps (inkl. Pull-Request-Vorschau-Umgebungen).
Custom-Domain `henrikgrosche.is-a.dev` statt der Azure-Standardadresse (siehe
DECISIONS.md für die Begründung).
