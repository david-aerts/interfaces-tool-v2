import path from "node:path";
import fs from "node:fs/promises";
import { PATHS } from "../core/paths/paths.js";
import { getDirectSubdirectoryNames, pathExists } from "../core/utils/fs-utils.js";
import { compareVersions } from "../core/utils/version-utils.js";
import { PublishedApiRow, PublishedSchemaRow } from "./summary-types.js";

function toRelativeLink(fromPath: string, toPath: string): string {
  return path.relative(fromPath, toPath).split(path.sep).join("/");
}
async function getCreatedDateString(filePath: string): Promise<string> {
  const stats = await fs.stat(filePath);
  return stats.birthtime.toLocaleString();
}
function parseVersion(value: string): string | null {
  const match = value.match(/_v(\d+\.\d+\.\d+)\./);
  return match ? match[1] : null;
}

export async function collectPublishedSchemaSummaryRows(): Promise<PublishedSchemaRow[]> {
  const names = await getDirectSubdirectoryNames(PATHS.publishedSchemas);
  const rows: PublishedSchemaRow[] = [];
  for (const name of names) {
    const dir = path.join(PATHS.publishedSchemas, name);
    const files = await fs.readdir(dir);
    const versions = files
      .map((fileName) => {
        const match = fileName.match(new RegExp(`^${name}_v(\\d+\\.\\d+\\.\\d+)\\.schema\\.yaml$`));
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];
    versions.sort(compareVersions);
    for (let i=0;i<versions.length;i++) {
      const version = versions[i];
      const yamlPath = path.join(dir, `${name}_v${version}.schema.yaml`);
      const jsonPath = path.join(dir, `${name}_v${version}.schema.json`);
      const rnPath = path.join(dir, `${name}_v${version}.release-notes.html`);
      rows.push({
        name,
        version,
        createdDate: await getCreatedDateString(yamlPath),
        json: await pathExists(jsonPath) ? { label: path.basename(jsonPath), href: toRelativeLink(PATHS.publishedRoot, jsonPath) } : undefined,
        yaml: { label: path.basename(yamlPath), href: toRelativeLink(PATHS.publishedRoot, yamlPath) },
        releaseNotes: await pathExists(rnPath) ? { label: path.basename(rnPath), href: toRelativeLink(PATHS.publishedRoot, rnPath) } : undefined,
      });
    }
  }
  rows.sort((a,b)=> a.name===b.name ? compareVersions(a.version,b.version) : a.name.localeCompare(b.name));
  return rows;
}

async function collectPublishedApiRows(root: string, summaryRoot: string, yamlExtension: string, htmlExtension: string): Promise<PublishedApiRow[]> {
  const names = await getDirectSubdirectoryNames(root);
  const rows: PublishedApiRow[] = [];
  for (const name of names) {
    const dir = path.join(root, name);
    const files = await fs.readdir(dir);
    const escaped = yamlExtension.replace(/\./g, "\\.");
    const versions = files
      .map((fileName) => {
        const match = fileName.match(new RegExp(`^${name}_v(\\d+\\.\\d+\\.\\d+)\\.${escaped}$`));
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];
    versions.sort(compareVersions);
    for (const version of versions) {
      const yamlPath = path.join(dir, `${name}_v${version}.${yamlExtension}`);
      const htmlPath = path.join(dir, `${name}_v${version}.${htmlExtension}`);
      const rnPath = path.join(dir, `${name}_v${version}.release-notes.html`);
      rows.push({
        name,
        version,
        createdDate: await getCreatedDateString(yamlPath),
        yaml: { label: path.basename(yamlPath), href: toRelativeLink(summaryRoot, yamlPath) },
        html: await pathExists(htmlPath) ? { label: path.basename(htmlPath), href: toRelativeLink(summaryRoot, htmlPath) } : undefined,
        releaseNotes: await pathExists(rnPath) ? { label: path.basename(rnPath), href: toRelativeLink(summaryRoot, rnPath) } : undefined,
      });
    }
  }
  rows.sort((a,b)=> a.name===b.name ? compareVersions(a.version,b.version) : a.name.localeCompare(b.name));
  return rows;
}

export async function collectPublishedOpenApiSummaryRows(): Promise<PublishedApiRow[]> {
  return collectPublishedApiRows(PATHS.publishedOpenApis, PATHS.publishedRoot, "openapi.yaml", "openapi.html");
}

export async function collectPublishedAsyncApiSummaryRows(): Promise<PublishedApiRow[]> {
  return collectPublishedApiRows(PATHS.publishedAsyncApis, PATHS.publishedRoot, "asyncapi.yaml", "asyncapi.html");
}
