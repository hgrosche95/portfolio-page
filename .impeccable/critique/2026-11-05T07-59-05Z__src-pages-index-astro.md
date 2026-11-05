---
target: Startseite
total_score: 23
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 2
target_identity: "file:/home/user/portfolio-page/src/pages/index.astro"
target_fingerprint: "sha256:40fc458168453619f3dcb7e2e8ec2ec33e153a8a54bfc2a263f155a35fa1fe39"
target_path: /home/user/portfolio-page/src/pages/index.astro
timestamp: 2026-11-05T07-59-05Z
slug: src-pages-index-astro
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score (Experience mode)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Pipeline has no run status/durations |
| 2 | Match System / Real World | 3 | Nav "Werdegang" vs section "Stationen" |
| 3 | User Control and Freedom | 3 | Many rows open at once -> very long page |
| 4 | Consistency and Standards | 2 | "ohne Ton" vs Roguelike trailer with sound; "life-ops-platform" slug title; duplicate live link in open row |
| 5 | Error Prevention | 3 | Honeypot, inline validation |
| 6 | Recognition Rather Than Recall | 3 | Search hit does not show matched term |
| 7 | Flexibility and Efficiency | n/a | portfolio |
| 8 | Aesthetic and Minimalist Design | 3 | Demo reel (~1180x740) outweighs hero |
| 9 | Error Recovery | 3 | Field errors + helpful empty search |
| 10 | Help and Documentation | n/a | portfolio |
| Total | | 23/32 | Good (72%) |

## Design Specificity
Authored: trace, agent console, schematics. Generic: skills grid, contact cards. Missed: pipeline claims real data but test stage is hardcoded.
Detector: CLI 0; browser 1 (1440) / 2 (390), all verified false positives (kicker label; hidden desktopHint counted).

## Priority Issues
1. [P1] Project order contradicts positioning: card game order 1 and open by default; agent projects collapsed (/impeccable layout)
2. [P1] Demo reel oversized + "ohne Ton" wrong for Roguelike trailer (/impeccable layout, /impeccable clarify)
3. [P2] Schematic labels 6-7px on 390px (hero console + rows) (/impeccable adapt)
4. [P2] Pipeline proves little: no test counts/durations/run link (/impeccable harden)
5. [P3] Timeline fully collapsed; Werdegang vs Stationen (/impeccable clarify)

## Persona Red Flags
Taylor (senior engineer): no measured number anywhere; skills.ts omits FastAPI, pgvector, Prisma, Bicep, Playwright, Langfuse, LoRA, Ollama. Jordan: availability unclear; card game first. Riley: single-item filter kinds. Casey: unreadable schematics; Werdegang missing in mobile nav.

## Minor Observations
Trailing bullet in hero stack wrap; skills chips look like active filters; "Health-Check öffnen" odd next to demos; console types only after ~2.5s.

## Questions
No measured number despite "messbare Agenten"? Filter and search for 7 projects? Demo reel as own section?
