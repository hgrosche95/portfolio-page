import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import matter from 'gray-matter';
import satori from 'satori';
import sharp from 'sharp';

/**
 * Builds the social preview images (the picture WhatsApp, LinkedIn or Slack
 * show when the link is pasted). They are generated here rather than drawn by
 * hand so that adding a project MDX file stays the only step needed — its card
 * appears with the next build.
 *
 * satori renders the layout to an SVG with the glyphs already turned into
 * paths, so sharp can rasterise it without depending on fonts being installed
 * on the build machine. That keeps local and CI output identical.
 *
 * sharp is a declared devDependency even though Astro's image pipeline already
 * pulls it in: this script imports it directly, so it must not rely on staying
 * a transitive dependency of something else. Both resolve to one deduped copy.
 */

const PROJECTS_DIR = 'src/content/projects';
const OUT_DIR = 'public/og';
/** The aspect ratio social cards crop to (~1.91:1). */
const WIDTH = 1200;
const HEIGHT = 630;

const COLORS = {
  bg: '#0d1117',
  surface: '#12181f',
  border: '#262d38',
  text: '#e6edf3',
  muted: '#8b98a5',
  accent: '#4ade80',
};

const fontDir = 'node_modules/@fontsource/jetbrains-mono/files';
const fonts = [
  {
    name: 'JetBrains Mono',
    data: readFileSync(`${fontDir}/jetbrains-mono-latin-400-normal.woff`),
    weight: 400 as const,
    style: 'normal' as const,
  },
  {
    name: 'JetBrains Mono',
    data: readFileSync(`${fontDir}/jetbrains-mono-latin-700-normal.woff`),
    weight: 700 as const,
    style: 'normal' as const,
  },
];

type Card = { slug: string; eyebrow: string; title: string; body: string; tags: string[] };

/**
 * satori has no text-overflow, so long copy is cut to fit the fixed card —
 * at the last word boundary, so it never breaks mid-word.
 */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).replace(/[,;:.\s]+$/, '')}…`;
}

function layout(card: Card) {
  return {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: COLORS.bg,
        // Mirrors the accent glow behind the site's own hero. The explicit
        // stops matter: without a transparent end satori renders a hard edge
        // where the gradient meets the background.
        backgroundImage:
          'radial-gradient(1100px 620px at 50% -20%, rgba(74,222,128,0.20) 0%, rgba(74,222,128,0.08) 45%, rgba(74,222,128,0) 100%)',
        padding: '64px 72px',
        fontFamily: 'JetBrains Mono',
        borderTop: `8px solid ${COLORS.accent}`,
      },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column' },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 24,
                    letterSpacing: 2,
                    color: COLORS.accent,
                    textTransform: 'uppercase',
                  },
                  children: card.eyebrow,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    marginTop: 20,
                    fontSize: card.title.length > 26 ? 60 : 74,
                    fontWeight: 700,
                    color: COLORS.text,
                    lineHeight: 1.15,
                  },
                  children: card.title,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    marginTop: 24,
                    fontSize: 27,
                    color: COLORS.muted,
                    lineHeight: 1.45,
                  },
                  // Three lines hold roughly 195 characters at this size; the
                  // limit stays under that so the copy never reaches the tags.
                  children: truncate(card.body, 175),
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex' },
                  children: card.tags.slice(0, 4).map((tag) => ({
                    type: 'div',
                    props: {
                      style: {
                        marginRight: 12,
                        border: `1px solid ${COLORS.border}`,
                        backgroundColor: COLORS.surface,
                        borderRadius: 6,
                        padding: '8px 16px',
                        fontSize: 22,
                        color: COLORS.muted,
                      },
                      children: tag,
                    },
                  })),
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: 22, color: COLORS.muted },
                  children: 'henrikgrosche.is-a.dev',
                },
              },
            ],
          },
        },
      ],
    },
  };
}

async function render(card: Card) {
  const svg = await satori(layout(card) as Parameters<typeof satori>[0], {
    width: WIDTH,
    height: HEIGHT,
    fonts,
  });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(`${OUT_DIR}/${card.slug}.png`, png);
  return png.length;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const cards: Card[] = [
    {
      slug: 'default',
      eyebrow: 'Full-Stack-Entwickler · Düsseldorf',
      title: 'Henrik Grosche',
      body: 'Ich baue Systeme und verbinde sie zu effizienten, automatisierten Workflows.',
      tags: ['TypeScript', 'React', 'Node.js', 'Azure'],
    },
  ];

  for (const file of readdirSync(PROJECTS_DIR).filter((name) => name.endsWith('.mdx'))) {
    const { data } = matter(readFileSync(`${PROJECTS_DIR}/${file}`, 'utf-8'));
    cards.push({
      slug: file.replace(/\.mdx$/, ''),
      eyebrow: 'Projekt',
      title: data.title,
      body: data.summary,
      tags: data.techStack ?? [],
    });
  }

  for (const card of cards) {
    const bytes = await render(card);
    console.log(`og/${card.slug}.png (${Math.round(bytes / 1024)} KB)`);
  }

  console.log(`${cards.length} Open-Graph-Bilder erzeugt`);
}

main();
