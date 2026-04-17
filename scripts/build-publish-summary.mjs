// scripts/build-publish-summary.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import { PATHS } from "./utils/project-paths.mjs";
import { ensureDirectory, pathExists } from "./utils/build-utils.mjs";

const execAsync = promisify(exec);

/**
 * Escapes HTML special characters.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Converts a filesystem path to a browser-friendly relative path.
 *
 * @param {string} fromPath
 * @param {string} toPath
 * @returns {string}
 */
function toRelativeLink(fromPath, toPath) {
  return path.relative(fromPath, toPath).split(path.sep).join("/");
}

/**
 * Returns the file creation date as a readable string.
 *
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function getCreatedDateString(filePath) {
  const stats = await fs.stat(filePath);
  return stats.birthtime.toLocaleString();
}

/**
 * Parses a semantic version string.
 *
 * @param {string} version
 * @returns {{ major: number, minor: number, patch: number }}
 */
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    return { major: 0, minor: 0, patch: 0 };
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * Compares two semantic versions.
 *
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);

  if (a.major !== b.major) {
    return a.major - b.major;
  }

  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }

  return a.patch - b.patch;
}

/**
 * Returns direct subdirectory names.
 *
 * @param {string} directoryPath
 * @returns {Promise<string[]>}
 */
async function getDirectSubdirectoryNames(directoryPath) {
  if (!(await pathExists(directoryPath))) {
    return [];
  }

  const entries = await fs.readdir(directoryPath, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/**
 * Builds rows for current schemas.
 *
 * Expected structure:
 * published-current/schemas/<schemaName>/<schemaName>.schema.yaml
 * published-current/schemas/<schemaName>/<schemaName>.schema.json
 *
 * @param {string} rootDirectory
 * @param {string} schemasDirectory
 * @returns {Promise<string[]>}
 */
async function buildCurrentSchemaRows(rootDirectory, schemasDirectory) {
  const schemaNames = await getDirectSubdirectoryNames(schemasDirectory);
  const rows = [];

  for (const schemaName of schemaNames.sort()) {
    const schemaDirectory = path.join(schemasDirectory, schemaName);
    const yamlPath = path.join(schemaDirectory, `${schemaName}.schema.yaml`);
    const jsonPath = path.join(schemaDirectory, `${schemaName}.schema.json`);

    const yamlExists = await pathExists(yamlPath);
    const jsonExists = await pathExists(jsonPath);

    if (!yamlExists && !jsonExists) {
      continue;
    }

    const createdDate = yamlExists
      ? await getCreatedDateString(yamlPath)
      : await getCreatedDateString(jsonPath);

    rows.push(`
      <tr>
        <td>${escapeHtml(schemaName)}</td>
        <td>${escapeHtml(createdDate)}</td>
        <td>${
          jsonExists
            ? `<a href="${escapeHtml(toRelativeLink(rootDirectory, jsonPath))}">${escapeHtml(path.basename(jsonPath))}</a>`
            : "-"
        }</td>
        <td>${
          yamlExists
            ? `<a href="${escapeHtml(toRelativeLink(rootDirectory, yamlPath))}">${escapeHtml(path.basename(yamlPath))}</a>`
            : "-"
        }</td>
      </tr>
    `);
  }

  return rows;
}

/**
 * Builds rows for versioned schemas.
 *
 * Expected structure:
 * published-version/schemas/<schemaName>/<schemaName>_vX.Y.Z.schema.yaml
 * published-version/schemas/<schemaName>/<schemaName>_vX.Y.Z.schema.json
 *
 * Release notes expected structure:
 * published-version/schemas/<schemaName>/release-notes/
 *   <schemaName>_v<previous>_to_v<current>.release-notes.html
 *
 * @param {string} rootDirectory
 * @param {string} schemasDirectory
 * @returns {Promise<string[]>}
 */
async function buildVersionedSchemaRows(rootDirectory, schemasDirectory) {
  const schemaNames = await getDirectSubdirectoryNames(schemasDirectory);
  const items = [];

  for (const schemaName of schemaNames) {
    const schemaDirectory = path.join(schemasDirectory, schemaName);

    const entries = await fs.readdir(schemaDirectory, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const match = entry.name.match(
        new RegExp(`^${schemaName}_v(\\d+\\.\\d+\\.\\d+)\\.schema\\.yaml$`)
      );

      if (!match) {
        continue;
      }

      const version = match[1];
      const yamlPath = path.join(schemaDirectory, entry.name);
      const jsonPath = path.join(
        schemaDirectory,
        `${schemaName}_v${version}.schema.json`
      );

      items.push({
        name: schemaName,
        version,
        createdDate: await getCreatedDateString(yamlPath),
        yamlPath,
        jsonPath,
        jsonExists: await pathExists(jsonPath),
      });
    }
  }

  items.sort((left, right) => {
    if (left.name !== right.name) {
      return left.name.localeCompare(right.name);
    }

    return compareVersions(left.version, right.version);
  });

  return items.map((item, index) => {
    let releaseNotesCell = "-";

    const previousItem =
      index > 0 && items[index - 1].name === item.name
        ? items[index - 1]
        : null;

    if (previousItem) {
      const releaseNotesHtmlPath = path.join(
        schemasDirectory,
        item.name,
        "release-notes",
        `${item.name}_v${previousItem.version}_to_v${item.version}.release-notes.html`
      );

      releaseNotesCell = (async () => {
        const exists = await pathExists(releaseNotesHtmlPath);

        if (!exists) {
          return "-";
        }

        return `<a href="${escapeHtml(
          toRelativeLink(rootDirectory, releaseNotesHtmlPath)
        )}">${escapeHtml(path.basename(releaseNotesHtmlPath))}</a>`;
      })();
    }

    return { item, releaseNotesCell };
  }).reduce(async (accPromise, currentPromise) => {
    const acc = await accPromise;
    const current = await currentPromise;
    const releaseNotesCell = await current.releaseNotesCell;

    acc.push(`
      <tr>
        <td>${escapeHtml(current.item.name)}</td>
        <td>${escapeHtml(current.item.version)}</td>
        <td>${escapeHtml(current.item.createdDate)}</td>
        <td>${
          current.item.jsonExists
            ? `<a href="${escapeHtml(toRelativeLink(rootDirectory, current.item.jsonPath))}">${escapeHtml(path.basename(current.item.jsonPath))}</a>`
            : "-"
        }</td>
        <td><a href="${escapeHtml(toRelativeLink(rootDirectory, current.item.yamlPath))}">${escapeHtml(path.basename(current.item.yamlPath))}</a></td>
        <td>${releaseNotesCell}</td>
      </tr>
    `);

    return acc;
  }, Promise.resolve([]));
}

/**
 * Builds rows for current APIs.
 *
 * Expected structure:
 * <apisDirectory>/<apiName>/<apiName>.<yamlExtension>
 * <apisDirectory>/<apiName>/<apiName>.<htmlExtension>
 *
 * @param {string} rootDirectory
 * @param {string} apisDirectory
 * @param {string} yamlExtension
 * @param {string} htmlExtension
 * @returns {Promise<string[]>}
 */
async function buildCurrentApiRows(
  rootDirectory,
  apisDirectory,
  yamlExtension,
  htmlExtension
) {
  const apiNames = await getDirectSubdirectoryNames(apisDirectory);
  const rows = [];

  for (const apiName of apiNames.sort()) {
    const apiDirectory = path.join(apisDirectory, apiName);
    const yamlPath = path.join(apiDirectory, `${apiName}.${yamlExtension}`);
    const htmlPath = path.join(apiDirectory, `${apiName}.${htmlExtension}`);

    const yamlExists = await pathExists(yamlPath);
    const htmlExists = await pathExists(htmlPath);

    if (!yamlExists && !htmlExists) {
      continue;
    }

    const createdDate = yamlExists
      ? await getCreatedDateString(yamlPath)
      : await getCreatedDateString(htmlPath);

    rows.push(`
      <tr>
        <td>${escapeHtml(apiName)}</td>
        <td>${escapeHtml(createdDate)}</td>
        <td>${
          yamlExists
            ? `<a href="${escapeHtml(toRelativeLink(rootDirectory, yamlPath))}">${escapeHtml(path.basename(yamlPath))}</a>`
            : "-"
        }</td>
        <td>${
          htmlExists
            ? `<a href="${escapeHtml(toRelativeLink(rootDirectory, htmlPath))}">${escapeHtml(path.basename(htmlPath))}</a>`
            : "-"
        }</td>
      </tr>
    `);
  }

  return rows;
}

/**
 * Builds rows for versioned APIs.
 *
 * Expected structure:
 * <apisDirectory>/<apiName>/<apiName>_vX.Y.Z.<yamlExtension>
 * <apisDirectory>/<apiName>/<apiName>_vX.Y.Z.<htmlExtension>
 *
 * @param {string} rootDirectory
 * @param {string} apisDirectory
 * @param {string} yamlExtension
 * @param {string} htmlExtension
 * @returns {Promise<string[]>}
 */

async function buildVersionedApiRows(
  rootDirectory,
  apisDirectory,
  yamlExtension,
  htmlExtension
) {
  const apiNames = await getDirectSubdirectoryNames(apisDirectory);
  const items = [];
  const escapedYamlExtension = yamlExtension.replace(/\./g, "\\.");

  for (const apiName of apiNames) {
    const apiDirectory = path.join(apisDirectory, apiName);

    const entries = await fs.readdir(apiDirectory, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const match = entry.name.match(
        new RegExp(`^${apiName}_v(\\d+\\.\\d+\\.\\d+)\\.${escapedYamlExtension}$`)
      );

      if (!match) {
        continue;
      }

      const version = match[1];
      const yamlPath = path.join(apiDirectory, entry.name);
      const htmlPath = path.join(
        apiDirectory,
        `${apiName}_v${version}.${htmlExtension}`
      );

      items.push({
        name: apiName,
        version,
        createdDate: await getCreatedDateString(yamlPath),
        yamlPath,
        htmlPath,
        htmlExists: await pathExists(htmlPath),
      });
    }
  }

  items.sort((left, right) => {
    if (left.name !== right.name) {
      return left.name.localeCompare(right.name);
    }

    return compareVersions(left.version, right.version);
  });

  const rows = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    let releaseNotesCell = "-";

    const previousItem =
      index > 0 && items[index - 1].name === item.name
        ? items[index - 1]
        : null;

    if (previousItem) {
      const releaseNotesHtmlPath = path.join(
        apisDirectory,
        item.name,
        "release-notes",
        `${item.name}_v${previousItem.version}_to_v${item.version}.release-notes.html`
      );

      if (await pathExists(releaseNotesHtmlPath)) {
        releaseNotesCell = `<a href="${escapeHtml(
          toRelativeLink(rootDirectory, releaseNotesHtmlPath)
        )}">${escapeHtml(path.basename(releaseNotesHtmlPath))}</a>`;
      }
    }

    rows.push(`
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.version)}</td>
        <td>${escapeHtml(item.createdDate)}</td>
        <td><a href="${escapeHtml(toRelativeLink(rootDirectory, item.yamlPath))}">${escapeHtml(path.basename(item.yamlPath))}</a></td>
        <td>${
          item.htmlExists
            ? `<a href="${escapeHtml(toRelativeLink(rootDirectory, item.htmlPath))}">${escapeHtml(path.basename(item.htmlPath))}</a>`
            : "-"
        }</td>
        <td>${releaseNotesCell}</td>
      </tr>
    `);
  }

  return rows;
}

/**
 * Builds one HTML table section.
 *
 * @param {string} title
 * @param {string[]} rows
 * @param {string[]} headers
 * @returns {string}
 */
function buildTableSection(title, rows, headers) {
  return `
    <h2>${escapeHtml(title)}</h2>
    <table>
      <thead>
        <tr>
          ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${
          rows.length > 0
            ? rows.join("\n")
            : `<tr><td colspan="${headers.length}">No files found.</td></tr>`
        }
      </tbody>
    </table>
  `;
}

/**
 * Builds the full HTML page.
 *
 * @param {string} title
 * @param {string} schemasSection
 * @param {string} openApisSection
 * @param {string} asyncApisSection
 * @returns {string}
 */
function buildPage(title, schemasSection, openApisSection, asyncApisSection) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 32px;
      color: #222;
      background: #fff;
    }

    h1 {
      margin-bottom: 24px;
    }

    h2 {
      margin-top: 40px;
      margin-bottom: 12px;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin-top: 12px;
    }

    th,
    td {
      border: 1px solid #d0d7de;
      padding: 10px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: #f5f5f5;
    }

    tr:nth-child(even) td {
      background: #fafafa;
    }

    a {
      color: #0969da;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>

  ${schemasSection}
  ${openApisSection}
  ${asyncApisSection}
</body>
</html>`;
}

/**
 * Builds published-current/index.html
 *
 * @returns {Promise<string>}
 */
async function buildPublishedCurrentSummary() {
  await ensureDirectory(PATHS.publishedCurrentRoot);

  const schemasSection = buildTableSection(
    "Schemas",
    await buildCurrentSchemaRows(
      PATHS.publishedCurrentRoot,
      PATHS.publishedCurrentSchemas
    ),
    ["Schema Name", "Created Date", "Schema JSON", "Schema YAML"]
  );

  const openApisSection = buildTableSection(
    "OpenAPIs",
    await buildCurrentApiRows(
      PATHS.publishedCurrentRoot,
      PATHS.publishedCurrentOpenApis,
      "openapi.yaml",
      "openapi.html"
    ),
    ["API Name", "Created Date", "OpenAPI YAML", "OpenAPI HTML"]
  );

  const asyncApisSection = buildTableSection(
    "AsyncAPIs",
    await buildCurrentApiRows(
      PATHS.publishedCurrentRoot,
      PATHS.publishedCurrentAsyncApis,
      "asyncapi.yaml",
      "asyncapi.html"
    ),
    ["API Name", "Created Date", "AsyncAPI YAML", "AsyncAPI HTML"]
  );

  const outputPath = path.join(PATHS.publishedCurrentRoot, "index.html");

  await fs.writeFile(
    outputPath,
    buildPage(
      "Published Current",
      schemasSection,
      openApisSection,
      asyncApisSection
    ),
    "utf8"
  );

  console.log(`Created: ${outputPath}`);
  return outputPath;
}

/**
 * Builds published-version/index.html
 *
 * @returns {Promise<string>}
 */
async function buildPublishedVersionSummary() {
  await ensureDirectory(PATHS.publishedVersionRoot);

  const versionedSchemaRows = await buildVersionedSchemaRows(
    PATHS.publishedVersionRoot,
    PATHS.publishedVersionSchemas
  );

  const schemasSection = buildTableSection(
    "Schemas",
    versionedSchemaRows,
    [
      "Schema Name",
      "Version",
      "Created Date",
      "Schema JSON",
      "Schema YAML",
      "Release Notes",
    ]
  );

  const openApisSection = buildTableSection(
    "OpenAPIs",
    await buildVersionedApiRows(
      PATHS.publishedVersionRoot,
      PATHS.publishedVersionOpenApis,
      "openapi.yaml",
      "openapi.html"
    ),
    ["API Name", "Version", "Created Date", "OpenAPI YAML", "OpenAPI HTML", "Release Notes"]
  );

  const asyncApisSection = buildTableSection(
    "AsyncAPIs",
    await buildVersionedApiRows(
      PATHS.publishedVersionRoot,
      PATHS.publishedVersionAsyncApis,
      "asyncapi.yaml",
      "asyncapi.html"
    ),
    ["API Name", "Version", "Created Date", "AsyncAPI YAML", "AsyncAPI HTML", "Release Notes"]
  );

  const outputPath = path.join(PATHS.publishedVersionRoot, "index.html");

  await fs.writeFile(
    outputPath,
    buildPage(
      "Published Version",
      schemasSection,
      openApisSection,
      asyncApisSection
    ),
    "utf8"
  );

  console.log(`Created: ${outputPath}`);
  return outputPath;
}

/**
 * Opens a file in the default browser on macOS.
 *
 * @param {string} filePath
 * @returns {Promise<void>}
 */
async function openFile(filePath) {
  await execAsync(`open "${filePath}"`);
}

/**
 * Main entry point.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const currentIndexPath = await buildPublishedCurrentSummary();
  const versionIndexPath = await buildPublishedVersionSummary();

  await openFile(currentIndexPath);
  await openFile(versionIndexPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});