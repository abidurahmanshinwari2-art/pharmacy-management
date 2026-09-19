const { createHmac } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");

const APP_ROOT = path.resolve(__dirname, "../../..");
const CONFIG_FILE = path.join(APP_ROOT, "backend", "config.json");
const PREFIX = "PMS";

function secret() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return String(cfg.licenseSecret || "pms-pharmacy-key-v1-h7n3r9q5").trim();
  } catch {
    return "pms-pharmacy-key-v1-h7n3r9q5";
  }
}

function normalizeShopName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function digestFor(shopName) {
  const body = `pms-shop-v1|${normalizeShopName(shopName).toLowerCase()}`;
  return createHmac("sha256", secret()).update(body).digest("hex").slice(0, 16).toUpperCase();
}

function formatKey(hex16) {
  const raw = String(hex16 || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  const chunks = raw.match(/.{1,4}/g) || [];
  return [PREFIX, ...chunks].join("-");
}

function createLicenseKey(shopName) {
  const name = normalizeShopName(shopName);
  if (!name) throw new Error("Write the pharmacy name.");
  return formatKey(digestFor(name));
}

function desktopDir() {
  const home = os.homedir();
  for (const folder of [path.join(home, "Desktop"), path.join(home, "OneDrive", "Desktop")]) {
    if (fs.existsSync(folder)) return folder;
  }
  return home;
}

function saveKeyFile(name, key) {
  const text = [
    "Pharmacy Management System — license key",
    "",
    "Pharmacy: " + name,
    "Key:      " + key,
    "",
    "Type this same pharmacy name and this same key on every PC for this shop.",
    "Do not change one letter.",
    "",
  ].join("\n");
  const file = path.join(desktopDir(), "pharmacy-license.txt");
  fs.writeFileSync(file, text, "utf8");
  return file;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(String(answer || "").trim());
    });
  });
}

async function waitToClose() {
  console.log("This window will stay open. Copy the key, then press Enter to close.");
  console.log("");
  await ask("");
}

async function main() {
  let name = process.argv.slice(2).join(" ").trim();
  if (!name) {
    console.log("");
    console.log("Write the pharmacy name, then press Enter.");
    console.log("Use the same spelling on every PC.");
    console.log("");
    name = await ask("Pharmacy name: ");
  }
  if (!name) {
    console.log("No pharmacy name was written. Run make-license.bat again.");
    await waitToClose();
    process.exit(1);
  }

  const key = createLicenseKey(name);
  let saved = "";
  try {
    saved = saveKeyFile(name, key);
  } catch {
    saved = "";
  }

  console.log("");
  console.log("========================================");
  console.log("Pharmacy: " + name);
  console.log("Key:      " + key);
  console.log("========================================");
  console.log("");
  if (saved) {
    console.log("This key is also saved here:");
    console.log(saved);
    console.log("");
  }
  console.log("Type this same pharmacy name and this same key on every PC for this shop.");
  console.log("Do not change one letter. Shop data on each PC stays on that PC.");
  console.log("");
  await waitToClose();
}

main().catch(async (err) => {
  console.log("");
  console.log("The license key was not made.");
  console.log(err && err.message ? err.message : String(err));
  console.log("");
  try {
    await waitToClose();
  } catch {
    // keep the batch pause as a backup
  }
  process.exit(1);
});
