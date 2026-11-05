import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

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

// Link to the CI run that built this deploy, so the pipeline on the page can
// point at the real run instead of only claiming one happened.
const runUrl =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null;

// Test results from the same CI job: its test steps write Vitest JSON reports
// to .ci/ (see the workflow). Missing locally, and then the page falls back to
// naming the test tools instead of showing numbers it doesn't have.
type VitestReport = {
  numTotalTests: number;
  numPassedTests: number;
  startTime: number;
  testResults: { endTime: number }[];
};

function readReport(path: string) {
  if (!existsSync(path)) return null;
  try {
    const report = JSON.parse(readFileSync(path, 'utf-8')) as VitestReport;
    const end = Math.max(report.startTime, ...report.testResults.map((r) => r.endTime));
    return { passed: report.numPassedTests, total: report.numTotalTests, durationMs: Math.round(end - report.startTime) };
  } catch {
    return null;
  }
}

const suites = [readReport('.ci/test-frontend.json'), readReport('.ci/test-api.json')].filter(
  (s): s is NonNullable<typeof s> => s !== null,
);
const tests = suites.length
  ? {
      passed: suites.reduce((n, s) => n + s.passed, 0),
      total: suites.reduce((n, s) => n + s.total, 0),
      durationMs: suites.reduce((n, s) => n + s.durationMs, 0),
    }
  : null;

const deployInfo = {
  sha,
  shortSha,
  message,
  author,
  timestamp,
  branch,
  runId,
  runUrl,
  tests,
  isLocal: !process.env.GITHUB_SHA,
};

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/deploy-info.json', JSON.stringify(deployInfo, null, 2));

console.log(`deploy-info.json written for commit ${shortSha}`);
