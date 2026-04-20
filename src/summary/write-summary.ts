import { writeTextFile } from "../core/utils/fs-utils.js";
import { PATHS } from "../core/paths/paths.js";
import { formatLink, renderSummaryHtml } from "./render-summary-html.js";
import { collectCurrentAsyncApiSummaryRows, collectCurrentOpenApiSummaryRows, collectCurrentSchemaSummaryRows } from "./collect-current-summary.js";
import { collectPublishedAsyncApiSummaryRows, collectPublishedOpenApiSummaryRows, collectPublishedSchemaSummaryRows } from "./collect-published-summary.js";

export async function writeCurrentSummary(): Promise<void> {
  const schemas = await collectCurrentSchemaSummaryRows();
  const openapis = await collectCurrentOpenApiSummaryRows();
  const asyncapis = await collectCurrentAsyncApiSummaryRows();

  const html = renderSummaryHtml("Current Summary", [
    {
      title: "Schemas",
      headers: ["Schema Name", "Created Date", "Schema JSON", "Schema YAML"],
      rows: schemas.map((row) => [row.name, row.createdDate, formatLink(row.json), formatLink(row.yaml)]),
    },
    {
      title: "OpenAPIs",
      headers: ["API Name", "Created Date", "OpenAPI YAML", "OpenAPI HTML"],
      rows: openapis.map((row) => [row.name, row.createdDate, formatLink(row.yaml), formatLink(row.html)]),
    },
    {
      title: "AsyncAPIs",
      headers: ["API Name", "Created Date", "AsyncAPI YAML", "AsyncAPI HTML"],
      rows: asyncapis.map((row) => [row.name, row.createdDate, formatLink(row.yaml), formatLink(row.html)]),
    },
  ]);

  await writeTextFile(PATHS.currentSummary, html);
}

export async function writePublishedSummary(): Promise<void> {
  const schemas = await collectPublishedSchemaSummaryRows();
  const openapis = await collectPublishedOpenApiSummaryRows();
  const asyncapis = await collectPublishedAsyncApiSummaryRows();

  const html = renderSummaryHtml("Published Summary", [
    {
      title: "Schemas",
      headers: ["Schema Name", "Version", "Created Date", "Schema JSON", "Schema YAML", "Release Notes"],
      rows: schemas.map((row) => [row.name, row.version, row.createdDate, formatLink(row.json), formatLink(row.yaml), formatLink(row.releaseNotes)]),
    },
    {
      title: "OpenAPIs",
      headers: ["API Name", "Version", "Created Date", "OpenAPI YAML", "OpenAPI HTML", "Release Notes"],
      rows: openapis.map((row) => [row.name, row.version, row.createdDate, formatLink(row.yaml), formatLink(row.html), formatLink(row.releaseNotes)]),
    },
    {
      title: "AsyncAPIs",
      headers: ["API Name", "Version", "Created Date", "AsyncAPI YAML", "AsyncAPI HTML", "Release Notes"],
      rows: asyncapis.map((row) => [row.name, row.version, row.createdDate, formatLink(row.yaml), formatLink(row.html), formatLink(row.releaseNotes)]),
    },
  ]);

  await writeTextFile(PATHS.publishedSummary, html);
}
