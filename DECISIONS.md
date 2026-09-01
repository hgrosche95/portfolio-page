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

## Content & structure

**Multi-page, not single-page scroll.** Considered a single scrolling page with anchor links,
chose separate routes per project (`/projects/[slug]`) instead. Reasoning: the node-graph
navigation needs somewhere to route *to*, and each project's "why/how" explanation needs room
to be substantive rather than squeezed into a scroll section.

**All four current repos are featured** (`great_galguti_game`, `ai-trip-planer`,
`Cocktail-Orders`, `job-application-skill`), even though none currently have GitHub
descriptions. The "why/how" write-up for each is drafted from actually reading the repo's code
and README — not just the repo name — specifically to avoid the site itself becoming an example
of shallow, non-developer-quality content.

**Contact kept simple on purpose.** `mailto:` link + LinkedIn + downloadable CV PDF, instead of
a contact form with a backend. A form (Azure Function) was considered and deliberately deferred
to a later iteration — it would add real backend complexity (spam handling, maintenance) for
a marginal gain on a portfolio site, but is kept as a known next step precisely because it *is*
a good way to further differentiate the site later.

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

**Azure Static Web Apps, free tier, default subdomain.** Chosen because everything in this
project needed to be free to run, and Static Web Apps' free tier covers static/Astro output
completely. Its built-in GitHub Actions integration is also the actual data source behind the
CI/CD pipeline visualization above — the "live" pipeline data is this site's real deploy
pipeline, not a mock. A custom domain (~10-15€/year) was considered and deferred, not rejected —
it can be attached to the same free hosting later without any rework.

## Scope philosophy

Ship an MVP first, then treat this as a living project that keeps being extended — itself a
signal of "actively maintained" work. Known backlog, deliberately deferred rather than
forgotten: a real contact form with an Azure Function backend, a custom domain, an English
translation, and additional projects as they're built.
