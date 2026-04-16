// scripts/build-all.mjs

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Runs a build script from package.json.
 *
 * @param {string} scriptName
 * @returns {Promise<void>}
 */
async function runScript(scriptName) {
  console.log(`\n=== Running ${scriptName} ===\n`);

  const command = process.platform === "win32" ? "npm.cmd" : "npm";

  await execFileAsync(command, ["run", scriptName], {
    stdio: "inherit",
  });
}

async function main() {
  await runScript("build:schemas");
  await runScript("build:openapis");
  await runScript("build:asyncapis");

  console.log("\nAll artifacts successfully generated.\n");
}

main().catch((error) => {
  console.error(error.stderr || error.message);
  process.exit(1);
});