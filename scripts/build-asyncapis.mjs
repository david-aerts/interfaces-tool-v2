// scripts/build-asyncapis.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = process.cwd();

const ASYNCAPIS_DIR = path.join(
  PROJECT_ROOT,
  "definition",
  "apis",
  "asyncApis"
);

const PUBLICATION_ASYNCAPIS_DIR = path.join(
  PROJECT_ROOT,
  "publication",
  "apis",
  "asyncApis"
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
  const entries = await fs.readdir(directoryPath, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

async function bundleAsyncApi(rootFilePath, outputFilePath) {
  await execFileAsync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "@asyncapi/cli",
      "bundle",
      rootFilePath,
      "--output",
      outputFilePath,
    ],
    {
      cwd: PROJECT_ROOT,
    }
  );
}

async function generateAsyncApiHtml(
  inputFilePath,
  outputDirectoryPath,
  outputFileName
) {
  await execFileAsync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "@asyncapi/cli",
      "generate",
      "fromTemplate",
      inputFilePath,
      "@asyncapi/html-template",
      "-o",
      outputDirectoryPath,
      "-p",
      "singleFile=true",
      "-p",
      `outFilename=${outputFileName}`,
    ],
    {
      cwd: PROJECT_ROOT,
    }
  );
}

async function buildOneAsyncApi(apiName) {
  const rootFilePath = path.join(
    ASYNCAPIS_DIR,
    apiName,
    `${apiName}.asyncapi.yaml`
  );

  if (!(await pathExists(rootFilePath))) {
    console.warn(
      `Skipping "${apiName}": missing root file ${rootFilePath}`
    );
    return;
  }

  const outputDir = path.join(PUBLICATION_ASYNCAPIS_DIR, apiName);

  await ensureDirectory(outputDir);

  const bundledFilePath = path.join(
    outputDir,
    `${apiName}.asyncapi.yaml`
  );

  const htmlFileName = `${apiName}.asyncapi.html`;

  console.log(`Bundling AsyncAPI "${apiName}"`);
  await bundleAsyncApi(rootFilePath, bundledFilePath);

  console.log(`Generating AsyncAPI HTML "${apiName}"`);
  await generateAsyncApiHtml(
    bundledFilePath,
    outputDir,
    htmlFileName
  );

  console.log(`Created: ${bundledFilePath}`);
  console.log(
    `Created: ${path.join(outputDir, htmlFileName)}`
  );
}

async function main() {
  if (!(await pathExists(ASYNCAPIS_DIR))) {
    throw new Error(
      `AsyncAPI directory not found: ${ASYNCAPIS_DIR}`
    );
  }

  await ensureDirectory(PUBLICATION_ASYNCAPIS_DIR);

  const apiNames = await getDirectSubdirectoryNames(ASYNCAPIS_DIR);

  if (apiNames.length === 0) {
    console.log("No AsyncAPI folders found.");
    return;
  }

  for (const apiName of apiNames) {
    try {
      await buildOneAsyncApi(apiName);
    } catch (error) {
      console.error(`Failed AsyncAPI "${apiName}"`);
      console.error(error.stderr || error.message);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});