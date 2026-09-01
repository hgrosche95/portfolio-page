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
  const stats: Record<string, RepoStats> = {};

  for (const repo of repos) {
    stats[repo] = await fetchRepoStats(repo);
  }

  mkdirSync('src/data', { recursive: true });
  writeFileSync('src/data/github-stats.json', JSON.stringify(stats, null, 2));
  console.log(`github-stats.json written for ${repos.length} repo(s)`);
}

main();
