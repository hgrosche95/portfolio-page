---
target: Startseite
total_score: 24
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 2
target_identity: "file:/home/user/portfolio-page/src/pages/index.astro"
target_fingerprint: "sha256:f5bedf4fab5ccec07f83fcb05e710ebbca81658b1078dbdb5c5b1b2376023dbe"
target_path: /home/user/portfolio-page/src/pages/index.astro
timestamp: 2026-11-05T08-37-01Z
slug: src-pages-index-astro
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score (Experience mode)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Pipeline stages identical, no per-step status |
| 2 | Match System / Real World | 3 | "Recall@3 · MRR" in a number slot without a number |
| 3 | User Control and Freedom | 3 | Esc/focus/close fine |
| 4 | Consistency and Standards | 2 | Skill chips styled like active filter chip; health check in live-demo pill |
| 5 | Error Prevention | 3 | required, maxlength, honeypot |
| 6 | Recognition Rather Than Recall | 3 | Whole row head clickable |
| 7 | Flexibility and Efficiency | n/a | portfolio |
| 8 | Aesthetic and Minimalist Design | 3 | Green live pills louder than copper |
| 9 | Error Recovery | 4 | Field errors, summary, focus, helpful empty search |
| 10 | Help and Documentation | n/a | portfolio |
| Total | | 24/32 | Good (75%) |

## Design Specificity
Specific: trace as IA, real schematics, real console run. Weakened by green pills and 41-chip skills wall.
Detector: CLI 0; browser 1 (1440) / 2 (390): kicker all-caps (deliberate label), line-length at 390 false positive (hidden desktopHint counted).

## Priority Issues
1. [P1] Trip Planner metric without a number ("Recall@3 · MRR") -> read current values from eval-data at build time, dated (/impeccable harden)
2. [P1] Skill chips look like active filters; 41 unranked tags (/impeccable distill)
3. [P2] "Health-Check öffnen" leads to raw JSON in live-demo pill (/impeccable clarify)
4. [P2] Green live pills outshout titles (/impeccable quieter)
5. [P2] Werdegang all closed; mobile date column squeezes titles (/impeccable adapt)

## Persona Red Flags
Taylor: metric without value; identical pipeline stages. Jordan: closed timeline, unranked skills, JSON link, years of experience not stated. Riley: search covers only title+tech. Casey: top-right controls; ~3 screens to row 3.

## Minor Observations
Dangling bullet in hero stack; "und 37 weitere" anchor; demo aside vertically centred; console log clipped at 1024; DECISIONS.md says dark by default (code follows system); skip link overlaps logo.

## Questions
Flagship eval rate vs roguelike latency? "Was ich messe" strip under hero? Three open timeline entries?
