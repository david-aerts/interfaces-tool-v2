// scripts/build-apis-summary.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { PATHS } from "./utils/project-paths.mjs";
import {
  ensureDirectory,
  pathExists,
} from "./utils/build-utils.mjs";

/**
 * Returns all direct subdirectories of a directory.
 *
 * @param {string} directoryPath
 * @returns {Promise<string[]>}
 */
async function getDirectSubdirectoryNames(directoryPath) {
  const entries = await fs.readdir(directoryPath, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/**
 * Returns all HTML files found directly inside one API output folder.
 *
 * @param {string} directoryPath
 * @returns {Promise<string[]>}
 */
async function getHtmlFiles(directoryPath) {
  const entries = await fs.readdir(directoryPath, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Escapes HTML special characters.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Builds the HTML rows for one API type.
 *
 * @param {"openapi" | "asyncapi"} apiType
 * @param {string} apisRootDirectory
 * @param {string} typeDirectoryPath
 * @returns {Promise<string[]>}
 */
async function buildRowsForType(apiType, apisRootDirectory, typeDirectoryPath) {
  if (!(await pathExists(typeDirectoryPath))) {
    return [];
  }

  const apiNames = await getDirectSubdirectoryNames(typeDirectoryPath);
  const rows = [];

  for (const apiName of apiNames.sort()) {
    const apiDirectoryPath = path.join(typeDirectoryPath, apiName);
    const htmlFiles = await getHtmlFiles(apiDirectoryPath);

    for (const htmlFileName of htmlFiles) {
      const relativeLink = path.relative(
        apisRootDirectory,
        path.join(apiDirectoryPath, htmlFileName)
      );

      const normalizedRelativeLink = relativeLink.split(path.sep).join("/");

      rows.push(`
        <tr>
          <td>${escapeHtml(apiType)}</td>
          <td>${escapeHtml(apiName)}</td>
          <td><a href="${escapeHtml(normalizedRelativeLink)}">${escapeHtml(htmlFileName)}</a></td>
        </tr>
      `);
    }
  }

  return rows;
}

/**
 * Returns the full HTML page content.
 *
 * @param {string} title
 * @param {string[]} rows
 * @returns {string}
 */
function buildHtmlPage(title, rows) {
  const tableBody =
    rows.length > 0
      ? rows.join("\n")
      : `
        <tr>
          <td colspan="3">No API HTML documentation found.</td>
        </tr>
      `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      color-scheme: light;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 32px;
      color: #222;
      background: #fff;
    }

    h1 {
      margin-bottom: 8px;
    }

    p {
      margin-top: 0;
      color: #555;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin-top: 24px;
    }

    th,
    td {
      border: 1px solid #d0d7de;
      padding: 12px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: #f6f8fa;
    }

    tr:nth-child(even) td {
      background: #fbfbfb;
    }

    a {
      color: #0969da;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .meta {
      margin-top: 24px;
      font-size: 14px;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>Available OpenAPI and AsyncAPI HTML documentation files found under this folder.</p>

  <table>
    <thead>
      <tr>
        <th>Type</th>
        <th>Name</th>
        <th>HTML</th>
      </tr>
    </thead>
    <tbody>
      ${tableBody}
    </tbody>
  </table>

  <div class="meta">
    Generated automatically from the contents of this folder.
  </div>
</body>
</html>
`;
}

/**
 * Builds one summary page for a given APIs root.
 *
 * @param {object} configuration
 * @param {string} configuration.title
 * @param {string} configuration.apisRootDirectory
 * @param {string} configuration.openApisDirectory
 * @param {string} configuration.asyncApisDirectory
 * @returns {Promise<void>}
 */
async function buildOneSummary(configuration) {
  const {
    title,
    apisRootDirectory,
    openApisDirectory,
    asyncApisDirectory,
  } = configuration;

  await ensureDirectory(apisRootDirectory);

  const openApiRows = await buildRowsForType(
    "openapi",
    apisRootDirectory,
    openApisDirectory
  );

  const asyncApiRows = await buildRowsForType(
    "asyncapi",
    apisRootDirectory,
    asyncApisDirectory
  );

  const rows = [...openApiRows, ...asyncApiRows];
  const htmlContent = buildHtmlPage(title, rows);

  const summaryFilePath = path.join(apisRootDirectory, "index.html");

  await fs.writeFile(summaryFilePath, htmlContent, "utf8");

  console.log(`Created: ${summaryFilePath}`);
}

/**
 * Main entry point.
 *
 * @returns {Promise<void>}
 */
async function main() {
  await buildOneSummary({
    title: "Published Current APIs Summary",
    apisRootDirectory: PATHS.publishedCurrentApis,
    openApisDirectory: PATHS.publishedCurrentOpenApis,
    asyncApisDirectory: PATHS.publishedCurrentAsyncApis,
  });

  await buildOneSummary({
    title: "Published Version APIs Summary",
    apisRootDirectory: PATHS.publishedVersionApis,
    openApisDirectory: PATHS.publishedVersionOpenApis,
    asyncApisDirectory: PATHS.publishedVersionAsyncApis,
  });
}

/**
 * Small helper to avoid repeating PATHS.projectRoot in object literals above.
 *
 * @returns {string}
 */
function PROJECT_ROOT_PLACEHOLDER() {
  return PATHS.projectRoot;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});