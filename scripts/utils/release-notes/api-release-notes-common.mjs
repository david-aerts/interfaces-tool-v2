
import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

export async function readYaml(filePath) {
  return yaml.load(await fs.readFile(filePath, "utf8"));
}

export async function writeReleaseNotesFiles(outputDirectoryPath, fileBaseName, releaseNotes) {
  await fs.mkdir(outputDirectoryPath, { recursive: true });

  const jsonPath = path.join(outputDirectoryPath, `${fileBaseName}.json`);
  const mdPath = path.join(outputDirectoryPath, `${fileBaseName}.md`);
  const htmlPath = path.join(outputDirectoryPath, `${fileBaseName}.html`);

  await fs.writeFile(jsonPath, JSON.stringify(releaseNotes, null, 2) + "\n", "utf8");
  await fs.writeFile(mdPath, buildMarkdown(releaseNotes), "utf8");
  await fs.writeFile(htmlPath, buildHtml(releaseNotes), "utf8");
}

export function buildReleaseNotes(artifactType, artifactName, fromVersion, toVersion, changes) {
  return {
    artifactType,
    artifactName,
    fromVersion,
    toVersion,
    generatedAt: new Date().toISOString(),
    changes,
  };
}

export function normalizeApiDocument(document) {
  const clone = JSON.parse(JSON.stringify(document));

  if (clone?.info && typeof clone.info === "object") {
    delete clone.info.version;
  }

  return clone;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildMarkdown(releaseNotes) {
  const lines = [
    `# Release notes — ${releaseNotes.artifactName} v${releaseNotes.fromVersion} → v${releaseNotes.toVersion}`,
    "",
    "| Element | Category | Breaking | Message |",
    "| --- | --- | --- | --- |",
  ];

  for (const change of releaseNotes.changes) {
    lines.push(
      `| ${change.element} | ${change.category} | ${change.breaking ? "Yes" : "No"} | ${change.message.replaceAll("|", "\\|")} |`
    );
  }

  return lines.join("\n") + "\n";
}

export function buildHtml(releaseNotes) {
  const rows = releaseNotes.changes
    .map((change) => {
      return `
        <tr class="${change.breaking ? "breaking" : ""}">
          <td>${escapeHtml(change.element)}</td>
          <td>${escapeHtml(change.category)}</td>
          <td>${change.breaking ? "Yes" : "No"}</td>
          <td>${escapeHtml(change.path)}</td>
          <td>${escapeHtml(change.message)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(`${releaseNotes.artifactName} ${releaseNotes.fromVersion} → ${releaseNotes.toVersion}`)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; }
    h1 { margin-bottom: 8px; }
    p { color: #666; }
    table { border-collapse: collapse; width: 100%; margin-top: 24px; }
    th, td { border: 1px solid #ccc; padding: 10px; text-align: left; vertical-align: top; }
    th { background: #f4f4f4; }
    tr.breaking td { background: #ffe9e9; }
  </style>
</head>
<body>
  <h1>${escapeHtml(releaseNotes.artifactName)}</h1>
  <p>Version ${escapeHtml(releaseNotes.fromVersion)} → ${escapeHtml(releaseNotes.toVersion)}</p>
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

export function createChange({
  artifactType,
  element,
  path,
  category,
  message,
  breaking = true,
}) {
  return {
    artifactType,
    element,
    path,
    category,
    message,
    breaking,
  };
}

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isVersionedSchemaRef(value) {
  return typeof value === "string" && /_v\d+\.\d+\.\d+/.test(value);
}

export function getRefVersion(value) {
  const match = typeof value === "string" ? value.match(/_v(\d+\.\d+\.\d+)/) : null;
  return match ? match[1] : null;
}

export function getRefBaseName(value) {
  if (typeof value !== "string") {
    return null;
  }

  const slashParts = value.split("/");
  const last = slashParts[slashParts.length - 1];
  if (!last) {
    return value;
  }

  return last
    .replace(/_v\d+\.\d+\.\d+/, "")
    .replace(/\.schema\.(yaml|json)$/, "")
    .replace(/^#\/components\/schemas\//, "");
}

export function defaultUnclassifiedChange(artifactType, element, currentPath, key) {
  return createChange({
    artifactType,
    element,
    path: `${currentPath}.${key}`,
    category: "unclassified-change",
    message: `Unclassified change detected on '${key}'.`,
    breaking: true,
  });
}
