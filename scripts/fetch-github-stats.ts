import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import matter from 'gray-matter';

const PROJECTS_DIR = 'src/content/projects';
const GITHUB_OWNER = 'hgrosche95';

type ProjectFrontmatter = {
  githubRepo: string;
};

type RepoStats = {
  stars: number;
  language: string | null;
  lastPushedAt: string;
  description: string | null;
};

function readProjectRepos(): string[] {
  const files = readdirSync(PROJECTS_DIR).filter((file) => file.endsWith('.mdx'));
  return files.map((file) => {
    const raw = readFileSync(`${PROJECTS_DIR}/${file}`, 'utf-8');
    const { data } = matter(raw) as { data: ProjectFrontmatter };
    return data.githubRepo;
  });
}

async function fetchRepoStats(repo: string): Promise<RepoStats> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${repo}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API request for ${repo} failed: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  return {
    stars: json.stargazers_count,
    language: json.language,
    lastPushedAt: json.pushed_at,
    description: json.description,
  };
}

async function main() {
  const repos = readProjectRepos();

  // allSettled rather than all: one unreachable repo must not take the other
  // four with it, and the requests are independent anyway.
  const results = await Promise.allSettled(repos.map((repo) => fetchRepoStats(repo)));

  const stats: Record<string, RepoStats> = {};
  const failures: string[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      stats[repos[index]] = result.value;
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failures.push(`${repos[index]} — ${reason}`);
    }
  });

  mkdirSync('src/data', { recursive: true });
  writeFileSync('src/data/github-stats.json', JSON.stringify(stats, null, 2));

  if (failures.length > 0) {
    // These numbers are decorative, and every consumer already renders without
    // them - so a GitHub outage must not be able to block a deploy of an
    // unrelated text change. Warned loudly all the same: a revoked token would
    // otherwise quietly become permanent.
    console.warn(`WARNUNG: keine GitHub-Daten für ${failures.length} von ${repos.length} Repo(s):`);
    for (const failure of failures) console.warn(`  - ${failure}`);
  }

  console.log(`github-stats.json written for ${Object.keys(stats).length}/${repos.length} repo(s)`);
}

// Only our own failures (unreadable content directory, unwritable target) are
// real build errors. Third-party ones are handled above and degrade instead.
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
