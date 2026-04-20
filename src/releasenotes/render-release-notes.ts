import { ReleaseNotes } from "./release-note-types.js";

function escapeHtml(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderReleaseNotesMarkdown(releaseNotes: ReleaseNotes): string {
  const lines = [
    `# Release notes — ${releaseNotes.artifactName} v${releaseNotes.fromVersion} → v${releaseNotes.toVersion}`,
    "",
    "| Element | Category | Breaking | Message |",
    "| --- | --- | --- | --- |",
  ];
  for (const change of releaseNotes.changes) {
    lines.push(`| ${change.element} | ${change.category} | ${change.breaking ? "Yes" : "No"} | ${change.message.replaceAll("|", "\\|")} |`);
  }
  return lines.join("\n") + "\n";
}

export function renderReleaseNotesHtml(releaseNotes: ReleaseNotes): string {
  const rows = releaseNotes.changes.map((change) => `
    <tr class="${change.breaking ? "breaking" : ""}">
      <td>${escapeHtml(change.element)}</td>
      <td>${escapeHtml(change.category)}</td>
      <td>${change.breaking ? "Yes" : "No"}</td>
      <td>${escapeHtml(change.path)}</td>
      <td>${escapeHtml(change.message)}</td>
    </tr>
  `).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(`${releaseNotes.artifactName} ${releaseNotes.fromVersion} → ${releaseNotes.toVersion}`)}</title>
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
<p>Version ${escapeHtml(releaseNotes.fromVersion)} → ${escapeHtml(releaseNotes.toVersion)}</p>
<table>
<thead><tr><th>Element</th><th>Category</th><th>Breaking</th><th>Path</th><th>Message</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body></html>`;
}
