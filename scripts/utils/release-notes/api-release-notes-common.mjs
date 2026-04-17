
import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

/**
 * Returns true when the value is a plain object.
 *
 * @param {any} value
 * @returns {boolean}
 */
export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Escapes HTML special characters.
 *
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Adds a change only if the exact same change is not already present.
 *
 * @param {object[]} changes
 * @param {object} change
 * @returns {void}
 */
export function pushUniqueChange(changes, change) {
  const key = JSON.stringify(change);

  if (!changes.some((existingChange) => JSON.stringify(existingChange) === key)) {
    changes.push(change);
  }
}

/**
 * Reads a YAML file.
 *
 * @param {string} filePath
 * @returns {Promise<object>}
 */
export async function readYaml(filePath) {
  return yaml.load(await fs.readFile(filePath, "utf8"));
}

/**
 * Writes release notes in JSON, Markdown and HTML formats.
 *
 * @param {string} outputDirectoryPath
 * @param {string} fileBaseName
 * @param {object} releaseNotes
 * @returns {Promise<void>}
 */
export async function writeApiReleaseNotes(
  outputDirectoryPath,
  fileBaseName,
  releaseNotes
) {
  await fs.mkdir(outputDirectoryPath, { recursive: true });

  await fs.writeFile(
    path.join(outputDirectoryPath, `${fileBaseName}.json`),
    JSON.stringify(releaseNotes, null, 2) + "\n",
    "utf8"
  );

  await fs.writeFile(
    path.join(outputDirectoryPath, `${fileBaseName}.md`),
    buildMarkdown(releaseNotes),
    "utf8"
  );

  await fs.writeFile(
    path.join(outputDirectoryPath, `${fileBaseName}.html`),
    buildHtml(releaseNotes),
    "utf8"
  );
}

/**
 * Builds the release note wrapper object.
 *
 * @param {"openapi"|"asyncapi"} artifactType
 * @param {string} artifactName
 * @param {string} fromVersion
 * @param {string} toVersion
 * @param {object[]} changes
 * @returns {object}
 */
export function buildApiReleaseNotes(
  artifactType,
  artifactName,
  fromVersion,
  toVersion,
  changes
) {
  return {
    artifactType,
    artifactName,
    fromVersion,
    toVersion,
    generatedAt: new Date().toISOString(),
    changes,
  };
}

/**
 * Builds markdown release notes.
 *
 * @param {object} releaseNotes
 * @returns {string}
 */
export function buildMarkdown(releaseNotes) {
  const rows = releaseNotes.changes
    .map(
      (change) =>
        `| ${change.element} | ${change.category} | ${change.breaking ? "Yes" : "No"} | ${change.message} |`
    )
    .join("\n");

  return `# Release notes — ${releaseNotes.artifactName} v${releaseNotes.fromVersion} → v${releaseNotes.toVersion}

| Element | Category | Breaking | Message |
|----------|----------|----------|----------|
${rows}
`;
}

/**
 * Builds HTML release notes.
 *
 * @param {object} releaseNotes
 * @returns {string}
 */
export function buildHtml(releaseNotes) {
  const rows = releaseNotes.changes
    .map(
      (change) => `
        <tr class="${change.breaking ? "breaking" : ""}">
          <td>${escapeHtml(change.element)}</td>
          <td>${escapeHtml(change.category)}</td>
          <td>${change.breaking ? "Yes" : "No"}</td>
          <td>${escapeHtml(change.path)}</td>
          <td>${escapeHtml(change.message)}</td>
        </tr>
      `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(
    `${releaseNotes.artifactName} ${releaseNotes.fromVersion} → ${releaseNotes.toVersion}`
  )}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; }
    table { border-collapse: collapse; width: 100%; margin-top: 24px; }
    th, td { border: 1px solid #ccc; padding: 10px; text-align: left; vertical-align: top; }
    th { background: #f4f4f4; }
    tr.breaking td { background: #ffe9e9; }
  </style>
</head>
<body>
  <h1>${escapeHtml(releaseNotes.artifactName)}</h1>
  <p>Version ${escapeHtml(releaseNotes.fromVersion)} → ${escapeHtml(
    releaseNotes.toVersion
  )}</p>
  <table>
    <thead>
      <tr>
        <th>Element</th>
        <th>Category</th>
        <th>Breaking</th>
        <th>Path</th>
        <th>Message</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}
