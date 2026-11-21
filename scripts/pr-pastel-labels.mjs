// Event-driven, idempotent PR labels. Only trusted default-branch code runs.
// Never check out, import, or execute source from an incoming pull request.
import { readFile } from "node:fs/promises";

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN;
const eventName = process.env.GITHUB_EVENT_NAME;
const eventPath = process.env.GITHUB_EVENT_PATH;
const apiRoot = process.env.GITHUB_API_URL || "https://api.github.com";

if (repo !== "duykhang68/techblogtip" || !token) {
  throw new Error("Expected the TechBlogTip repository and an Actions token");
}

const palette = {
  "type: feature": ["BFE8D5", "New feature or enhancement"],
  "type: bugfix": ["FFD7CE", "Bug fix or regression repair"],
  "type: test": ["DDD6FE", "Tests and acceptance coverage"],
  "type: docs": ["CCE7FA", "Documentation and guides"],
  "type: ci": ["FDE8B5", "CI/CD and workflow changes"],
  "type: performance": ["BBEBE5", "Speed and rendering performance"],
  "type: refactor": ["E8D9F8", "Internal cleanup without behavior changes"],
  "type: content": ["FADBE9", "Article and editorial content"],
  "type: chore": ["DCE3EE", "Repository maintenance"],
  "area: publisher": ["CFE6FB", "Google Sheets Publisher and Editorial Studio"],
  "area: interface": ["FADDF3", "Blog layout and user experience"],
  "area: deployment": ["FFF0C6", "Deployment and release verification"],
  "area: security": ["FFCFDA", "Authentication and security"],
  "area: dependencies": ["E0E5EF", "Dependency updates and Dependabot"],
  "area: ci": ["D8E5FB", "Automation and CI infrastructure"],
  "dependencies": ["D9E5FA", "Dependency updates (legacy Dependabot label)"],
  "javascript": ["D8EFD5", "JavaScript updates (legacy Dependabot label)"],
};

async function api(method, path, payload) {
  const response = await fetch(apiRoot + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(method + " " + path + ": HTTP " + response.status + " " + body.slice(0, 350));
  }
  return body ? JSON.parse(body) : null;
}

async function ensurePastelPalette() {
  const existing = new Map();
  for (let page = 1; ; page++) {
    const batch = await api("GET", "/repos/" + repo + "/labels?per_page=100&page=" + page);
    for (const label of batch) existing.set(label.name, label);
    if (batch.length < 100) break;
  }

  let changed = 0;
  for (const [name, [color, description]] of Object.entries(palette)) {
    const old = existing.get(name);
    if (!old) {
      await api("POST", "/repos/" + repo + "/labels", { name, color, description });
      changed++;
    } else if (old.color.toUpperCase() !== color || old.description !== description) {
      await api("PATCH", "/repos/" + repo + "/labels/" + encodeURIComponent(name), {
        color,
        description,
      });
      changed++;
    }
  }
  console.log("Pastel palette checked; labels created or recolored: " + changed);
}

function classify(title) {
  const match = title.match(/^\s*(feat|fix|docs|test|ci|perf|refactor|content|chore)(?:\([^)]+\))?\s*:/i);
  const kinds = {
    feat: "feature",
    fix: "bugfix",
    docs: "docs",
    test: "test",
    ci: "ci",
    perf: "performance",
    refactor: "refactor",
    content: "content",
    chore: "chore",
  };
  const type = match ? "type: " + kinds[match[1].toLowerCase()] : null;
  const text = title.toLowerCase();
  let area = null;

  if (/(publisher|editor|sheets|p5[a-z0-9]*)/.test(text)) area = "publisher";
  else if (/(visual|toc|home|article|ui\b|layout|responsive)/.test(text)) area = "interface";
  else if (/(deploy|pages|release|cloudflare|production)/.test(text)) area = "deployment";
  else if (/(security|audit|auth)/.test(text)) area = "security";
  else if (/(dependabot|deps|typescript)/.test(text)) area = "dependencies";
  else if (/(ci\b|actions|workflow)/.test(text)) area = "ci";

  return { type, area: area ? "area: " + area : null };
}

async function labelPR(pr) {
  const current = new Set((pr.labels || []).map((label) => label.name));
  const { type, area } = classify(pr.title || "");
  const add = [];

  if (type && !current.has(type)) add.push(type);
  if (area && ![...current].some((label) => label.startsWith("area: ")) && !current.has(area)) add.push(area);

  if (add.length > 0) {
    try {
      await api("POST", "/repos/" + repo + "/issues/" + pr.number + "/labels", { labels: add });
    } catch (error) {
      // GitHub's Actions token may be barred from writing labels to some historical
      // bot-authored PRs. Preserve the remaining backfill instead of failing early.
      if (String(error).includes('HTTP 403') &&
          String(error).includes('Resource not accessible by integration')) {
        console.warn("::warning::PR #" + pr.number + " labels unchanged: GitHub denied the integration token");
        return;
      }
      throw error;
    }
  }
  console.log("PR #" + pr.number + ": " + (add.length ? add.join(", ") : "already labeled"));
}

await ensurePastelPalette();

if (eventName === "pull_request_target") {
  const event = JSON.parse(await readFile(eventPath, "utf8"));
  if (!event.pull_request?.number) throw new Error("Missing pull request event payload");
  await labelPR(event.pull_request);
} else if (eventName === "push" || eventName === "workflow_dispatch") {
  let count = 0;
  for (let page = 1; ; page++) {
    const prs = await api("GET", "/repos/" + repo + "/pulls?state=all&per_page=100&page=" + page);
    for (const pr of prs) {
      await labelPR(pr);
      count++;
    }
    if (prs.length < 100) break;
  }
  console.log("Historical PR backfill checked: " + count);
} else {
  throw new Error("Unexpected event: " + eventName);
}
