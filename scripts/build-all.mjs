import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Runs one npm script.
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

/**
 * Builds all artifacts in the expected order:
 * 1. schemas
 * 2. openapis
 * 3. asyncapis
 */
async function main() {
  await runScript("schemas");
  await runScript("openapis");
  await runScript("asyncapis");

  console.log("\nAll artifacts successfully generated.\n");
}

main().catch((error) => {
  console.error(error.stderr || error.message);
  process.exit(1);
});
