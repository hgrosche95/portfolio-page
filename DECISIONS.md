# Design Decisions

This document records the reasoning behind this portfolio site's design and tech choices —
what was decided, what alternatives were considered, and why. It exists so the decisions can
be explained or shared, not just followed.

## Goal

A portfolio site for job applications that itself demonstrates full-stack development skill —
not a template site a non-developer could produce. It needs to show, not just describe, the
skills listed on the CV: React/Next.js/TypeScript frontends, Node.js backends, API/system
integration, CI/CD literacy.

Audience: both technical reviewers (dev leads, CTOs) who'll evaluate the implementation itself,
and non-technical recruiters/HR who need a fast, skimmable first impression. The site is
designed with layered depth rather than as two separate versions.

## Signature technical elements

**Functional node-graph as site navigation.** The homepage centerpiece is an animated
node-graph / flow-diagram, styled after the kind of system-integration work described in the
CV (connecting Outlook, Nextcloud, Advoware, and Brevo into one automated workflow). It's not
decorative — clicking a node routes to that project's page. This was chosen over a generic
hero animation because it demonstrates the actual skill being claimed (connecting systems)
rather than just looking impressive.

**Live CI/CD pipeline visualization.** Rather than a static description of "I have CI/CD
experience," the site pulls real data from its own last GitHub Actions deploy (commit, status,
timestamp) and renders it as an animated pipeline. A true real-time live ticker was considered
and rejected — deploys are infrequent, so a "live" widget would sit static most of the time and
read as boring rather than impressive. Instead, the real data replays as an animation on every
page load: honest (no fabricated data) but always visually alive.

**Live GitHub API data for projects.** Project cards pull live stats (stars, last commit,
language) from the GitHub API rather than being hardcoded, layered on top of hand-written
"why/how" explanations for each project.

**Reachability check for scale-to-zero demos, done server-to-server.** Two of the live project
demos run their backend on Azure Container Apps with scale-to-zero: after a few idle minutes the
container sleeps, and the first real request takes 30-40s to wake it back up (measured directly:
38s on a cold request). Without a warning, a visitor clicking the live-demo button in that window
sees nothing happen and reasonably assumes the demo is broken. A direct browser-side check was
considered and rejected: both backends' CORS policy only allows their own frontend's origin, so a
fetch from this site's origin would be blocked — and a CORS rejection is indistinguishable from a
dead server on the client side, making the check worse than useless. Solved with a small Azure
Function on this site (`api/src/functions/live-status.ts`) that probes server-to-server instead,
where CORS doesn't apply. The target URL always comes from a fixed allowlist keyed by project
slug, never from the request: accepting a caller-supplied URL here would turn a reachability
check into an open fetch proxy. Results are cached briefly (20s) so several visitors hitting a
project page at once don't each trigger their own probe against someone else's server.

**Project filter: derived tags, not a hand-picked list; dims the graph, hides the list.** The
homepage's tag filter only offers tags that recur across at least two projects, computed from the
same `techStack` frontmatter the cards and node-graph already read — a tag only one project has
would be a filter with exactly one possible result, which isn't a filter, just a relabelled link
to that project. The card list and the graph react differently to a non-matching project on
purpose: the list hides it outright (it's explicitly framed as "the same projects as a list"),
while the graph dims it instead of removing it, because the graph is also the structural map of
shared infrastructure (which projects share Azure, Docker, GitHub Actions) — removing a node
would force a re-fit/reflow of the whole layout for what is otherwise a purely cosmetic change.

## Content & structure

**Multi-page, not single-page scroll.** Considered a single scrolling page with anchor links,
chose separate routes per project (`/projects/[slug]`) instead. Reasoning: the node-graph
navigation needs somewhere to route *to*, and each project's "why/how" explanation needs room
to be substantive rather than squeezed into a scroll section.

**Every project repo gets featured**, not a curated subset — six as of this writing (the two
game/agent projects, AI Trip Planner, Cocktail Orders, the job-application Claude Code skill,
and this site itself). Adding one is a single MDX file under `src/content/projects/`; title,
tech stack, GitHub API card data, node-graph position and optional architecture diagram all come
from that file's frontmatter, so extending the site doesn't require touching component code (see
`src/content.config.ts`). Each project's "why/how" write-up is drafted from actually reading that
repo's code, not just its README or repo name — a project's own README turned out to be stale on
a real architecture change at least once, caught only by checking source directly. Doing this
specifically avoids the site itself becoming an example of shallow, non-developer-quality content.

**Contact form: built, not deferred.** The original plan here kept contact simple (`mailto:` +
LinkedIn + CV download only) and deferred a real form as a known next step. It was built shortly
after: an Azure Function backend (delivery via Brevo) with a honeypot field and a best-effort,
in-memory rate limit rather than a shared store — deliberately sized to what a portfolio contact
form actually needs, not a general-purpose form platform. `mailto:`/LinkedIn/CV download stayed
as a fallback alongside it rather than being replaced, since a backend outage or a JS failure
should never be the only way to reach out.

**Impressum/Datenschutzerklärung included**, using city + email only rather than a full home
address. German TMG/DSGVO Impressum obligations are a legal grey area for a non-commercial
personal portfolio, but including a minimal one anyway avoids risk cheaply. Full postal address
was considered and rejected in favor of the reduced version — the legally cleanest option
would be the full address, but that's an unnecessary privacy trade-off for a personal
non-commercial site.

**German first, English deferred.** The CV is German and lists English as "good" rather than
fluent. Bilingual support is real, not fake — it's an explicit backlog item, not abandoned —
but doing it well for the MVP would slow the initial ship.

## Visual identity

Dark mode by default with a light-mode toggle, in a "developer/terminal" aesthetic (monospace
accents, code-block styling). Chosen over a neutral corporate-portfolio look because it fits the
node-graph/pipeline visual language and reads as clearly developer-made rather than templated.
Uses an actual personal photo rather than an icon/initials treatment, for the same reason a face
usually helps in recruiting contexts: it builds trust faster than an abstraction.

## Tech stack: Astro + React islands (not plain Next.js)

This was reopened mid-planning after a direct challenge: *does everything need to run through
React, or is that unnecessary overhead?*

The honest answer was yes, plain Next.js would have been overkill. Most of the site — About,
skills, the experience timeline, project write-ups, contact, Impressum — is static content with
no interactivity. Shipping a full Next.js/React app means shipping and hydrating the React
runtime for all of it, including pages that never need to be interactive. That directly worked
against the stated performance goal.

Three options were weighed:

1. **Plain Next.js (the original choice).** Matches the CV's listed skills exactly, fast to
   build, but pays a real hydration/bundle cost for content that's purely static.
2. **Astro with React islands (chosen).** Astro renders the site as static HTML/CSS by default
   and only loads React for the specific interactive components — the node-graph and the CI/CD
   widget. This keeps React demonstrated exactly where it earns its place (the interactive,
   "impressive" parts), while everything else ships with near-zero JavaScript. Better Lighthouse
   numbers than option 1, at the cost of one additional (deliberately lightweight) tool to know.
3. **No framework — vanilla TypeScript + Vite.** Would maximize performance further, but stops
   demonstrating the React/Next.js skills the CV explicitly claims, and pushes routing/state
   management onto hand-rolled code — more MVP time cost for a site that's meant to ship fast
   first.

Astro + React islands was chosen as the option that doesn't force a trade-off between the two
things that actually mattered here: proving React competence, and being fast. It still deploys
to Azure Static Web Apps on the free tier exactly as planned, with routing for the per-project
pages intact.

## Hosting & deployment

**Azure Static Web Apps, free tier.** Chosen because everything in this project needed to be
free to run, and Static Web Apps' free tier covers static/Astro output completely. Its built-in
GitHub Actions integration is also the actual data source behind the CI/CD pipeline
visualization above — the "live" pipeline data is this site's real deploy pipeline, not a mock.

**Custom domain: `henrikgrosche.is-a.dev`, not a paid TLD.** A paid domain (~10-15€/year) was
considered and deferred early on, but a nicer-than-`*.azurestaticapps.net` name was still worth
having for free. is-a.dev issues free subdomains specifically for developer
portfolios/projects via a reviewed PR to their public GitHub registry (a JSON file mapping the
subdomain to a CNAME target) — a good fit precisely because that's what this site is. DuckDNS
was considered and rejected: it's a dynamic-DNS service associated with home-server/self-hosting
use (Home Assistant, Plex, etc.), and would read as an odd choice on a professional portfolio to
a technical reviewer who recognizes it. Free "vanity" TLDs like `.tk`/`.ml` were rejected outright
for their spam/malware reputation. Azure's side of attaching a custom domain (plus managed TLS)
is free on the same SKU — only the naming layer differs from a paid domain, not the mechanics.

## Scope philosophy

Ship an MVP first, then treat this as a living project that keeps being extended — itself a
signal of "actively maintained" work. Known backlog, deliberately deferred rather than
forgotten: an English translation, and additional projects as they're built. The contact form
that used to be on this list was built (see Content & structure above); it's the clearest
evidence so far that the backlog gets acted on rather than just accumulated.
