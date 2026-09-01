import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

function git(format: string): string {
  return execSync(`git log -1 --format=${format}`, { encoding: 'utf-8' }).trim();
}

const sha = process.env.GITHUB_SHA ?? git('%H');
const shortSha = sha.slice(0, 7);
const message = git('%s');
const author = git('%an');
const timestamp = git('%aI');
const branch =
  process.env.GITHUB_REF_NAME ??
  execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
const runId = process.env.GITHUB_RUN_ID ?? 'local';

const deployInfo = {
  sha,
  shortSha,
  message,
  author,
  timestamp,
  branch,
  runId,
  isLocal: !process.env.GITHUB_SHA,
};

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/deploy-info.json', JSON.stringify(deployInfo, null, 2));

console.log(`deploy-info.json written for commit ${shortSha}`);
