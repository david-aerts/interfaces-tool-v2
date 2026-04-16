// scripts/utils/build-api-docs.mjs

import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  ensureDirectory,
  getDirectSubdirectoryNames,
  pathExists,
} from "./build-utils.mjs";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = process.cwd();

/**
 * Executes an npx command from the project root.
 *
 * @param {string[]} commandArguments
 * @returns {Promise<void>}
 */
async function runNpx(commandArguments) {
  await execFileAsync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    commandArguments,
    {
      cwd: PROJECT_ROOT,
    }
  );
}

/**
 * Generic API build pipeline reused for both OpenAPI and AsyncAPI.
 *
 * When requestedApiName is provided, only that API is built.
 *
 * @param {object} configuration
 * @param {string} configuration.kind
 * @param {string} configuration.sourceDirectory
 * @param {string} configuration.outputDirectory
 * @param {string} configuration.rootExtension
 * @param {string} configuration.bundledExtension
 * @param {(rootFilePath: string, outputFilePath: string) => Promise<void>} configuration.bundle
 * @param {(bundledFilePath: string, outputDirectory: string, apiName: string) => Promise<void>} configuration.generateHtml
 * @param {string | null} [configuration.requestedApiName]
 * @returns {Promise<void>}
 */
export async function buildApis(configuration) {
  const {
    kind,
    sourceDirectory,
    outputDirectory,
    rootExtension,
    bundledExtension,
    bundle,
    generateHtml,
    requestedApiName = null,
  } = configuration;

  if (!(await pathExists(sourceDirectory))) {
    throw new Error(`${kind} directory not found: ${sourceDirectory}`);
  }

  await ensureDirectory(outputDirectory);

  const allApiNames = await getDirectSubdirectoryNames(sourceDirectory);

  const apiNames = requestedApiName
    ? allApiNames.filter((apiName) => apiName === requestedApiName)
    : allApiNames;

  if (requestedApiName && apiNames.length === 0) {
    throw new Error(
      `${kind} "${requestedApiName}" not found in ${sourceDirectory}`
    );
  }

  if (apiNames.length === 0) {
    console.log(`No ${kind} folders found.`);
    return;
  }

  for (const apiName of apiNames) {
    const rootFilePath = path.join(
      sourceDirectory,
      apiName,
      `${apiName}.${rootExtension}`
    );

    if (!(await pathExists(rootFilePath))) {
      console.warn(
        `Skipping "${apiName}": missing root file ${rootFilePath}`
      );
      continue;
    }

    try {
      const apiOutputDirectory = path.join(outputDirectory, apiName);

      await ensureDirectory(apiOutputDirectory);

      const bundledFilePath = path.join(
        apiOutputDirectory,
        `${apiName}.${bundledExtension}`
      );

      console.log(`Bundling ${kind} "${apiName}"`);
      await bundle(rootFilePath, bundledFilePath);

      console.log(`Generating ${kind} HTML "${apiName}"`);
      await generateHtml(
        bundledFilePath,
        apiOutputDirectory,
        apiName
      );

      console.log(`Created: ${bundledFilePath}`);
    } catch (error) {
      console.error(`Failed ${kind} "${apiName}"`);
      console.error(error.stderr || error.message);
      process.exitCode = 1;
    }
  }
}

/**
 * Bundles an OpenAPI definition using Redocly CLI.
 *
 * @param {string} rootFilePath
 * @param {string} outputFilePath
 * @returns {Promise<void>}
 */
export async function bundleOpenApi(rootFilePath, outputFilePath) {
  await runNpx([
    "@redocly/cli",
    "bundle",
    rootFilePath,
    "--output",
    outputFilePath,
  ]);
}

/**
 * Generates standalone HTML documentation for an OpenAPI file.
 *
 * @param {string} bundledFilePath
 * @param {string} outputDirectory
 * @param {string} apiName
 * @returns {Promise<void>}
 */
export async function generateOpenApiHtml(
  bundledFilePath,
  outputDirectory,
  apiName
) {
  await runNpx([
    "@redocly/cli",
    "build-docs",
    bundledFilePath,
    "--output",
    path.join(outputDirectory, `${apiName}.openapi.html`),
  ]);
}

/**
 * Bundles an AsyncAPI definition.
 *
 * @param {string} rootFilePath
 * @param {string} outputFilePath
 * @returns {Promise<void>}
 */
export async function bundleAsyncApi(rootFilePath, outputFilePath) {
  await runNpx([
    "@asyncapi/cli",
    "bundle",
    rootFilePath,
    "--output",
    outputFilePath,
  ]);
}

/**
 * Generates standalone HTML documentation for an AsyncAPI file.
 *
 * @param {string} bundledFilePath
 * @param {string} outputDirectory
 * @param {string} apiName
 * @returns {Promise<void>}
 */
export async function generateAsyncApiHtml(
  bundledFilePath,
  outputDirectory,
  apiName
) {
  await runNpx([
    "@asyncapi/cli",
    "generate",
    "fromTemplate",
    bundledFilePath,
    "@asyncapi/html-template",
    "-o",
    outputDirectory,
    "--force-write",
    "-p",
    "singleFile=true",
    "-p",
    `outFilename=${apiName}.asyncapi.html`,
  ]);
}