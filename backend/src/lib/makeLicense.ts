import readline from "node:readline";
import { createLicenseKey } from "./license";

function ask(question: string) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<string>((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(String(answer || "").trim());
    });
  });
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
    process.exit(1);
  }
  const key = createLicenseKey(name);
  console.log("");
  console.log("Pharmacy: " + name);
  console.log("Key:      " + key);
  console.log("");
  console.log("Type this same pharmacy name and this same key on every PC for this shop.");
  console.log("Do not change one letter. Shop data on each PC stays on that PC.");
  console.log("");
}

main();
