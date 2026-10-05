import { mkdir, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repository = "kqcoxn/MaaPipelineEditor";
const output = ".github/assets/readme/star-history.svg";
const day = 86400000;

// GitHub's aggregate API avoids fetching or storing stargazer identities.
// https://docs.github.com/en/rest/activity/starring#get-repository-star-history
export async function loadHistory({ token, request = fetch }) {
  async function get(endpoint) {
    const response = await request(`https://api.github.com/repos/${repository}${endpoint}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`GitHub ${endpoint || "repository"}: HTTP ${response.status}`);
    return response.json();
  }
  const metadata = await get("");
  const weeks = [];
  for (let page = 1; page <= 100; page++) {
    const batch = await get(`/stargazers/history?per_page=30&page=${page}`);
    if (!Array.isArray(batch)) throw new Error("Invalid star history response");
    weeks.push(...batch);
    if (batch.length < 30) return { metadata, weeks };
  }
  throw new Error("Star history pagination exceeded GitHub's limit");
}

export function buildPoints({ metadata, weeks }, now = new Date()) {
  const start = Date.parse(metadata.created_at);
  const end = now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end ||
      !Number.isInteger(metadata.stargazers_count) || metadata.stargazers_count < 0) {
    throw new Error("Invalid repository metadata");
  }
  const seen = new Set();
  const events = [];
  for (const week of weeks) {
    if (!Number.isInteger(week.week) || week.week < 0 || seen.has(week.week) ||
        !Array.isArray(week.days) || week.days.length !== 7 ||
        !week.days.every(n => Number.isInteger(n) && n >= 0) ||
        week.total !== week.days.reduce((sum, n) => sum + n, 0)) {
      throw new Error("Invalid or duplicate star history week");
    }
    seen.add(week.week);
    week.days.forEach((count, index) => {
      if (count) {
        const time = week.week * 1000 + index * day;
        // Calendar-day buckets can begin before the repository creation time.
        if (time < start - day || time > end) throw new Error("Star date outside repository lifetime");
        events.push([Math.max(start, time), count]);
      }
    });
  }
  events.sort((a, b) => a[0] - b[0]);
  let total = 0;
  const points = [[start, 0]];
  for (const [time, count] of events) points.push([time, total += count]);
  // A partial response or concurrent star change must not publish a misleading chart.
  if (total !== metadata.stargazers_count) throw new Error("Star history/count mismatch; retry later");
  points.push([end, total]);
  return points;
}

export function renderChart(points, now = new Date()) {
  const start = points[0][0], end = points.at(-1)[0], total = points.at(-1)[1];
  const ceiling = Math.max(5, Math.ceil(total / 5) * 5);
  const x = time => 76 + (time - start) / Math.max(1, end - start) * 770;
  const y = count => 382 - count / ceiling * 270;
  const date = time => new Date(time).toISOString().slice(0, 10);
  const line = points.map(([time, count]) => `${x(time).toFixed(2)},${y(count).toFixed(2)}`).join(" ");
  const ticks = Array.from({ length: 6 }, (_, i) => {
    const count = ceiling * i / 5;
    const time = start + (end - start) * i / 5;
    return `<path d="M76 ${y(count)}H846" class="grid"/>
  <text x="62" y="${y(count) + 5}" text-anchor="end">${count}</text>
  <text x="${x(time)}" y="410" text-anchor="middle">${date(time)}</text>`;
  }).join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="470" viewBox="0 0 920 470" role="img" aria-labelledby="title desc">
  <title id="title">MaaPipelineEditor Star History — ${total} stars</title>
  <desc id="desc">GitHub star history, updated ${date(now)} UTC. Reconstructed from current stars; removed stars are excluded.</desc>
  <style>
    text { font-family: system-ui, sans-serif; font-size: 13px; fill: #596579; }
    .background { fill: #fff; } .heading { fill: #18243a; font-size: 24px; font-weight: 700; }
    .grid { stroke: #e6eaf0; stroke-width: 1; }
    @media (prefers-color-scheme: dark) {
      .background { fill: #0d1117; } text { fill: #a5b1c2; }
      .heading { fill: #e6edf3; } .grid { stroke: #28313e; }
    }
  </style>
  <rect width="920" height="470" rx="12" class="background"/>
  <text x="76" y="44" class="heading">Star History</text>
  <text x="76" y="72">${repository}</text>
  <text x="846" y="44" text-anchor="end" class="heading">${total} stars</text>
  <text x="846" y="72" text-anchor="end">Updated ${date(now)} UTC</text>
  ${ticks}
  <polyline points="${line}" fill="none" stroke="#e97435" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="846" cy="${y(total)}" r="4" fill="#e97435"/>
</svg>
`;
}

export async function generate({ token = process.env.GITHUB_TOKEN } = {}) {
  const history = await loadHistory({ token });
  const now = new Date();
  const svg = renderChart(buildPoints(history, now), now);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(`${output}.tmp`, svg);
  await rename(`${output}.tmp`, output);
  console.log(`Generated ${output}: ${history.metadata.stargazers_count} stars`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generate();
}
