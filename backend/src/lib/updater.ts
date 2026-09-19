import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { APP_ROOT, appConfig, githubRepo, saveUserSettings, userSettings } from "./appPaths";

const execFileAsync = promisify(execFile);
const SKIP = new Set(["node_modules", ".git", "dist", "pharmacy-data"]);

function ghHeaders() {
  return { Accept: "application/vnd.github+json", "User-Agent": "PharmacyManagementSystem" };
}

async function latestGithub() {
  const repo = githubRepo();
  if (!repo) return null;
  const commitRes = await fetch(`https://api.github.com/repos/${repo}/commits/main`, { headers: ghHeaders() });
  if (!commitRes.ok) return null;
  const commit = await commitRes.json() as { sha?: string };
  const sha = String(commit.sha || "");
  if (!sha) return null;
  return {
    id: sha,
    name: sha.slice(0, 7),
    zip: `https://github.com/${repo}/archive/refs/heads/main.zip`,
    zipSha: `https://github.com/${repo}/archive/${sha}.zip`,
    url: `https://github.com/${repo}`,
  };
}

function copyTree(from: string, to: string) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    if (SKIP.has(name)) continue;
    const src = path.join(from, name);
    const dest = path.join(to, name);
    if (fs.statSync(src).isDirectory()) copyTree(src, dest);
    else fs.copyFileSync(src, dest);
  }
}

async function downloadZip(urls: string[], zipPath: string) {
  let last = "Could not download the update.";
  for (const url of urls) {
    if (!url) continue;
    try {
      const zipRes = await fetch(url, { headers: { "User-Agent": "PharmacyManagementSystem" }, redirect: "follow" });
      if (!zipRes.ok) {
        last = `Could not download the update (${zipRes.status}).`;
        continue;
      }
      fs.writeFileSync(zipPath, Buffer.from(await zipRes.arrayBuffer()));
      if (fs.statSync(zipPath).size > 1000) return true;
    } catch (err) {
      last = err instanceof Error ? err.message : last;
    }
  }
  throw new Error(last);
}

export async function checkUpdate() {
  const current = userSettings().installedId || appConfig().version;
  const remote = await latestGithub();
  if (!remote) {
    return {
      current,
      latest: current,
      available: false,
      url: "",
      note: githubRepo() ? "offline" : "no-repo",
    };
  }
  const installed = userSettings().installedId;
  return {
    current: installed ? String(installed).slice(0, 7) : remote.name,
    latest: remote.name,
    available: !installed || installed !== remote.id,
    url: remote.url,
    note: "ok",
  };
}

export async function applyUpdate() {
  const repo = githubRepo();
  if (!repo) return { ok: false, message: "No GitHub repo is set." };
  const remote = await latestGithub();
  if (!remote) return { ok: false, message: "No internet, or GitHub is closed." };

  const work = path.join(os.tmpdir(), `pharmacy-update-${Date.now()}`);
  const zipPath = path.join(work, "update.zip");
  fs.mkdirSync(work, { recursive: true });

  try {
    await downloadZip([
      remote.zip,
      `https://codeload.github.com/${repo}/zip/refs/heads/main`,
      remote.zipSha,
    ], zipPath);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not download the update." };
  }

  const unpacked = path.join(work, "unpacked");
  fs.mkdirSync(unpacked, { recursive: true });
  await execFileAsync("tar", ["-xf", zipPath, "-C", unpacked]);
  const inner = fs.readdirSync(unpacked).map((name) => path.join(unpacked, name)).find((p) => fs.statSync(p).isDirectory());
  if (!inner) return { ok: false, message: "The download was empty." };

  copyTree(inner, APP_ROOT);

  const distDir = path.join(APP_ROOT, "frontend", "dist");
  const stamp = path.join(distDir, ".ui-build");
  try {
    if (fs.existsSync(stamp)) fs.unlinkSync(stamp);
  } catch {
    // start script will rebuild
  }

  const distBackup = path.join(work, "dist-backup");
  if (fs.existsSync(path.join(distDir, "index.html"))) {
    fs.cpSync(distDir, distBackup, { recursive: true });
  }

  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    await execFileAsync(npm, ["--prefix", path.join(APP_ROOT, "backend"), "install"], { windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
    await execFileAsync(npm, ["--prefix", path.join(APP_ROOT, "frontend"), "install"], { windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
    await execFileAsync(npm, ["--prefix", path.join(APP_ROOT, "frontend"), "run", "build"], { windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(stamp, String(remote.id));
    saveUserSettings({ installedId: remote.id });
  } catch (err) {
    if (fs.existsSync(distBackup)) {
      try {
        fs.rmSync(distDir, { recursive: true, force: true });
        fs.cpSync(distBackup, distDir, { recursive: true });
      } catch {
        // start script will rebuild
      }
    }
    saveUserSettings({ installedId: remote.id });
    return {
      ok: false,
      restart: true,
      message: "Update files are here, but the screens did not build. Close the pharmacy and open it again.",
      detail: err instanceof Error ? err.message : "",
    };
  }

  try {
    fs.rmSync(work, { recursive: true, force: true });
  } catch {
    // temp folder can stay
  }

  return {
    ok: true,
    restart: true,
    message: "Update is installed. Close the pharmacy and open Pharmacy Management System again. Shop data on this PC is safe.",
  };
}
