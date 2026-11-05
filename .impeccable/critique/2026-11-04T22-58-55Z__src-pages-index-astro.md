---
target: Startseite
total_score: 22
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 1
target_identity: "file:/home/user/portfolio-page/src/pages/index.astro"
target_fingerprint: "sha256:08f7b04a67ac1f7dafd3f038cc128abdaefb9e056efcb1da0c753c154cba5452"
target_path: /home/user/portfolio-page/src/pages/index.astro
timestamp: 2026-11-04T22-58-55Z
slug: src-pages-index-astro
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score (Experience mode)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Filter count, video state ok; trace fill subtle |
| 2 | Match System / Real World | 3 | Hero console log opaque to non-engineers |
| 3 | User Control and Freedom | 3 | Esc/focus return ok |
| 4 | Consistency and Standards | 2 | 4 live-link labels; hero tags look like filter chips; errors in brand accent |
| 5 | Error Prevention | 3 | Inline validation, honeypot |
| 6 | Recognition Rather Than Recall | 3 | Mobile header drops Werdegang; search scope unclear |
| 7 | Flexibility and Efficiency | n/a | portfolio |
| 8 | Aesthetic and Minimalist Design | 3 | AI Trip Planner shown 3x before the project range |
| 9 | Error Recovery | 2 | Errors copper, no aria-invalid/describedby; search dead-end |
| 10 | Help and Documentation | n/a | portfolio |
| Total | | 22/32 | Acceptable (69%) |

## Design Specificity
Authored top (trace, hero, agent console, schematics), category-interchangeable middle (tabs+video, filter chips, accordion, tag grid, contact cards).
Detector: CLI 0; browser home 3 (all-caps kicker = false positive; 2x line-length real; mobile Timeline word overflow 16px real).

## Priority Issues
1. [P1] Projects buried behind demo reel repeat -> move ProjectIndex above DemoReel or fold demos into rows (/impeccable layout)
2. [P2] CI/CD section shows merge-commit subject incl. branch name; poster-size H2 for minor point; ~8px on mobile (/impeccable distill)
3. [P2] Form errors use accent colour, no invalid border, no aria-invalid/aria-describedby (/impeccable harden)
4. [P2] Inconsistent live-link labels, second green accent, hero tags read as buttons (/impeccable clarify)
5. [P3] Timeline order: Bachelor 2020 below Praktikum 2019 (/impeccable polish)

## Persona Red Flags
Jordan: code log in hero, no role/availability above fold, projects far down. Riley: two rows open at once, search dead-end, silent errors. Casey: Werdegang missing in mobile header, top-right controls, unlabelled chapter dots, 8px pipeline.

## Minor Observations
h1 textContent duplicated; "und 24 weitere" orphaned; weak search backdrop; filter kinds with 1 project.

## Questions
Trace connects nothing? Recruiter vs CTO first? Fewer sections stronger?

## Audit (technical) 16/20 Good
A11y 3, Performance 3 (React+xyflow ~122KB gz for one widget), Responsive 3 (header overflow at 200% text), Theming 4, Integrity 3.
