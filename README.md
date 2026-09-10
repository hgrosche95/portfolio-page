# Portfolio

Meine Bewerbungs-Portfolio-Seite — soll die im Lebenslauf gelisteten Skills
selbst zeigen, nicht nur beschreiben: React/TypeScript-Frontend,
Node-Backend, API-Integration, CI/CD. Die Begründung hinter den
Design-/Tech-Entscheidungen (warum Astro statt Next.js, warum
`is-a.dev`-Domain statt eigener TLD, u. a.) steht in [DECISIONS.md](DECISIONS.md).

Live: https://henrikgrosche.is-a.dev

## Features

- **Animierter Node-Graph als Navigation** — die Startseite zeigt ein
  klickbares Flow-Diagramm; jeder Knoten routet zur jeweiligen Projektseite,
  statt nur dekorativ zu sein.
- **Live-CI/CD-Pipeline-Visualisierung** — zieht echte Daten aus dem letzten
  eigenen GitHub-Actions-Deploy (Commit, Status, Zeitpunkt) und spielt sie
  bei jedem Seitenaufruf als Animation ab.
- **Live-GitHub-Daten pro Projektkarte** — Stars, letzter Commit, Sprache;
  nicht hardcodiert.
- **Tag-Filter für Karten und Node-Graph** — aus den echten Tech-Stack-Daten
  abgeleitet (nur Tags, die bei mindestens zwei Projekten vorkommen, sonst
  wäre es kein Filter, sondern nur eine Umbenennung eines Links); filtert
  die Kartenliste, dimmt nicht passende Knoten im Graphen statt sie zu
  entfernen.
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
├── content/projects/ Ein MDX-Dokument pro Projekt (Text, Tech-Stack, optionale Architektur-Graph-Daten)
├── components/       Astro-Komponenten + die interaktiven React-Inseln (NodeGraph, DeployPipeline)
├── data/             Generierte JSON-Daten (GitHub-Stats, Deploy-Info) — siehe scripts/
└── layouts/, styles/

scripts/              Läuft vor jedem dev/build (predev/prebuild): GitHub-Stats
                      holen, Deploy-Info erzeugen, OG-Bilder rendern (satori + sharp)

api/                  Eigenständige Azure-Functions-App (eigenes package.json):
                      Kontaktformular (contact.ts) und Live-Status-Check (live-status.ts)
```

Projekte werden als MDX-Datei unter `src/content/projects/` hinzugefügt —
Titel, Tech-Stack, optionaler Architektur-Graph und optionale Live-Demo
kommen komplett aus dem Frontmatter (siehe `src/content.config.ts`), keine
Komponente muss dafür angefasst werden.

## Stack

| Bereich | Wahl | Warum |
|---|---|---|
| Framework | Astro 7 + React-Islands | Die meisten Seiten (About, Timeline, Projekt-Texte) sind statisch — React wird nur für die interaktiven Teile (Node-Graph, CI/CD-Widget) geladen statt für die ganze Seite hydriert. Details: DECISIONS.md. |
| Styling | Tailwind 4 | Utility-first, passt zum "Dev/Terminal"-Look. |
| Content | MDX + Astro Content Collections | Projekt-Texte als Markdown mit typisiertem Frontmatter (Zod-Schema). |
| Node-Graph | `@xyflow/react` | Fertige, anpassbare Flow-Graph-Bibliothek statt Eigenbau. |
| API | Azure Functions (Node/TypeScript) | Passt zum Static-Web-Apps-Deployment: läuft im selben Free-Tier-Deployment mit, ohne eigenen Server. |
| Testing | Vitest | Für Frontend (`NodeGraph.test.ts`) und API (`contact.test.ts`, `live-status.test.ts`) getrennt. |
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
