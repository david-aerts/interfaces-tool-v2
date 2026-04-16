// scripts/build-openapis.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = process.cwd();

const OPENAPIS_DIR = path.join(
  PROJECT_ROOT,
  "definition",
  "apis",
  "openApis"
);

const PUBLICATION_OPENAPIS_DIR = path.join(
  PROJECT_ROOT,
  "publication",
  "apis",
  "openApis"
);

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function getDirectSubdirectoryNames(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

async function bundleOpenApi(rootFilePath, outputFilePath) {
  await execFileAsync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "@redocly/cli",
      "bundle",
      rootFilePath,
      "--output",
      outputFilePath
    ],
    { cwd: PROJECT_ROOT }
  );
}

async function buildOneOpenApi(apiName) {
  const rootFilePath = path.join(
    OPENAPIS_DIR,
    apiName,
    `${apiName}.openapi.yaml`
  );

  if (!(await pathExists(rootFilePath))) {
    console.warn(`Skipping "${apiName}": missing root file ${rootFilePath}`);
    return;
  }

  const outputDir = path.join(PUBLICATION_OPENAPIS_DIR, apiName);
  await ensureDirectory(outputDir);

  const outputFilePath = path.join(outputDir, `${apiName}.openapi.yaml`);

  console.log(`Bundling "${apiName}" from ${rootFilePath}`);

  await bundleOpenApi(rootFilePath, outputFilePath);

  console.log(`Done "${apiName}" -> ${outputFilePath}`);
}

async function main() {
  if (!(await pathExists(OPENAPIS_DIR))) {
    throw new Error(`OpenAPI directory not found: ${OPENAPIS_DIR}`);
  }

  await ensureDirectory(PUBLICATION_OPENAPIS_DIR);

  const apiNames = await getDirectSubdirectoryNames(OPENAPIS_DIR);

  if (apiNames.length === 0) {
    console.log("No OpenAPI folders found.");
    return;
  }

  for (const apiName of apiNames) {
    try {
      await buildOneOpenApi(apiName);
    } catch (error) {
      console.error(`Failed for "${apiName}"`);
      console.error(error.stderr || error.message);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});