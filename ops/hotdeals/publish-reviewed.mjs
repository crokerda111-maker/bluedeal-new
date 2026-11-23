import { readFile, writeFile, mkdir, rename, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = fileURLToPath(new URL("../../", import.meta.url));
const privateDir = join(root, "ops", "private");
const news = process.argv.includes("--news");
const dir = join(privateDir, news ? "news-publisher" : "hotdeal-publisher");
const reviewedDir = join(dir, "reviewed");
const resultDir = join(dir, "results");
const base = "https://bluedeal.co.kr";
const publishing = process.argv.includes("--publish");
const collecting = !news && process.argv.includes("--collect");

async function save(path, payload) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = path + "." + process.pid + ".tmp";
  await writeFile(tmp, JSON.stringify(payload, null, 2) + "\n", "utf8");
  await rename(tmp, path);
}

async function request(path, { body, cookie } = {}) {
  return fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body ?? {}),
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
}

async function adminLogin() {
  const access = await readFile(join(privateDir, "admin-access.local.txt"), "utf8");
  const password = access.match(/^ADMIN_PASSWORD=(.+)$/m)?.[1]?.trim();
  if (!password) throw new Error("ADMIN_CONFIG_MISSING");
  const response = await request("/api/admin/login", { body: { password } });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!response.ok || !cookie?.startsWith("bd_admin=v1.")) throw new Error("ADMIN_LOGIN_FAILED");
  return cookie;
}

async function collectCandidates() {
  const runtime = JSON.parse(await readFile(join(privateDir, "maintenance", "scheduled-runtime.local.json"), "utf8"));
  if (typeof runtime.python !== "string" || !/^[a-z]:\\/i.test(runtime.python)) throw new Error("PYTHON_CONFIG_MISSING");
  return new Promise((resolve, reject) => {
    const child = spawn(runtime.python, [join(root, "ops", "collector", "fetch_linkprice_review.py"), "--kind", "both"], {
      cwd: root, shell: false, windowsHide: true, stdio: "ignore",
    });
    child.once("error", () => reject(new Error("CANDIDATE_FETCH_FAILED")));
    child.once("exit", code => code === 0 ? resolve() : reject(new Error("CANDIDATE_FETCH_FAILED")));
  });
}

async function publishReviewed() {
  await mkdir(reviewedDir, { recursive: true });
  const pending = [];
  const stats = { pending: 0, expired: 0, posted: 0, existing: 0, rejected: 0, error: 0 };
  const now = Date.now();
  const names = (await readdir(reviewedDir, { withFileTypes: true }))
    .filter(entry => entry.isFile() && /^[a-zA-Z0-9_-]{1,100}\.json$/.test(entry.name))
    .map(entry => entry.name);
  for (const name of names) {
    const output = join(resultDir, name);
    try {
      const receipt = JSON.parse(await readFile(output, "utf8"));
      if (["posted", "existing", "expired"].includes(receipt.status)) continue;
    } catch (error) { if (error.code !== "ENOENT") throw error; }

    let body;
    try { body = JSON.parse(await readFile(join(reviewedDir, name), "utf8")); }
    catch { stats.rejected++; continue; }

    if (!body || typeof body !== "object" || Array.isArray(body) || body.reviewed !== true) continue;
    if (news) {
      if (["translation", "koreanEditing", "proofreading", "sensitiveContext"].some(key => body[key] !== true)) continue;
      const published = Date.parse(body.publishedAt);
      if (published > now || !Number.isFinite(published)) { stats.rejected++; continue; }
      if (published < now - 20 * 86_400_000) {
        stats.expired++;
        if (publishing) await save(output, { status: "expired", at: new Date().toISOString() });
        continue;
      }
      pending.push({ body, output });
      continue;
    }
    const checked = Date.parse(body.checkedAt);
    const end = Date.parse(body.validUntil);
    if (!Number.isFinite(checked) || !Number.isFinite(end) || end <= checked || end - checked > 86_400_000) {
      stats.rejected++;
      continue;
    }
    if (end <= now || checked < now - 21_600_000) {
      stats.expired++;
      if (publishing) await save(output, { status: "expired", at: new Date().toISOString() });
      continue;
    }
    if (checked > now || body.availability !== "in-stock") continue;
    pending.push({ body, output });
  }

  stats.pending = pending.length;
  if (!publishing || !pending.length) return stats;

  const cookie = await adminLogin();
  for (const { body, output } of pending.slice(0, 12)) {
    try {
      const response = await request(news ? "/api/internal/editorial-news" : "/api/internal/hotdeal", { body, cookie });
      const data = await response.json().catch(() => null);
      if (response.status === 422) {
        stats.rejected++;
        await save(output, { status: "rejected", code: response.status, at: new Date().toISOString() });
      } else if ((response.status === 200 || response.status === 201) && (news ? /^news-[a-f0-9]{32}$/ : /^deal-[a-f0-9]{32}$/).test(data?.id ?? "")) {
        const status = response.status === 201 ? "posted" : "existing";
        stats[status]++;
        await save(output, { status, id: data.id, at: new Date().toISOString() });
      } else {
        stats.error++;
        await save(output, { status: "retry", code: response.status, at: new Date().toISOString() });
      }
    } catch {
      stats.error++;
    }
  }
  return stats;
}

const summary = { at: new Date().toISOString(), mode: publishing ? "publish" : "preview", collection: collecting ? "pending" : "skip" };
try {
  if (collecting) {
    try { await collectCandidates(); summary.collection = "ok"; }
    catch { summary.collection = "error"; }
  }
  Object.assign(summary, await publishReviewed());
} catch {
  summary.run = "error";
}
if (publishing || collecting) await save(join(dir, collecting && !publishing ? "last-collection.local.json" : "last-run.local.json"), summary);
console.log(JSON.stringify(summary));
if (summary.run === "error" || summary.collection === "error" || summary.error) process.exitCode = 1;
