function escapeHtml(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function linkOrDash(item?: { href: string; label: string }): string {
  return item ? `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>` : "-";
}

export function renderSummaryHtml(title: string, sections: Array<{ title: string; headers: string[]; rows: string[][] }>): string {
  const content = sections.map((section) => `
    <h2>${escapeHtml(section.title)}</h2>
    <table>
      <thead>
        <tr>${section.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${section.rows.length > 0 ? section.rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${section.headers.length}">No files found.</td></tr>`}
      </tbody>
    </table>
  `).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><style>
  body { font-family: Arial, Helvetica, sans-serif; margin: 32px; color: #222; background: #fff; }
  h1 { margin-bottom: 24px; }
  h2 { margin-top: 40px; margin-bottom: 12px; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; }
  th, td { border: 1px solid #d0d7de; padding: 10px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  tr:nth-child(even) td { background: #fafafa; }
  a { color: #0969da; text-decoration: none; } a:hover { text-decoration: underline; }
  </style></head><body><h1>${escapeHtml(title)}</h1>${content}</body></html>`;
}

export function formatLink(item?: { href: string; label: string }): string {
  return linkOrDash(item);
}
