import path from "node:path";
import fs from "node:fs/promises";
import { PATHS } from "../core/paths/paths.js";
import { getDirectSubdirectoryNames, pathExists } from "../core/utils/fs-utils.js";
import { CurrentApiRow, CurrentSchemaRow } from "./summary-types.js";

function toRelativeLink(fromPath: string, toPath: string): string {
  return path.relative(fromPath, toPath).split(path.sep).join("/");
}

async function getCreatedDateString(filePath: string): Promise<string> {
  const stats = await fs.stat(filePath);
  return stats.birthtime.toLocaleString();
}

export async function collectCurrentSchemaSummaryRows(): Promise<CurrentSchemaRow[]> {
  const names = await getDirectSubdirectoryNames(PATHS.currentSchemas);
  const rows: CurrentSchemaRow[] = [];
  for (const name of names.sort()) {
    const dir = path.join(PATHS.currentSchemas, name);
    const yamlPath = path.join(dir, `${name}.schema.yaml`);
    const jsonPath = path.join(dir, `${name}.schema.json`);
    const yamlExists = await pathExists(yamlPath);
    const jsonExists = await pathExists(jsonPath);
    if (!yamlExists && !jsonExists) continue;
    const createdDate = await getCreatedDateString(yamlExists ? yamlPath : jsonPath);
    rows.push({
      name,
      createdDate,
      json: jsonExists ? { label: path.basename(jsonPath), href: toRelativeLink(PATHS.currentRoot, jsonPath) } : undefined,
      yaml: yamlExists ? { label: path.basename(yamlPath), href: toRelativeLink(PATHS.currentRoot, yamlPath) } : undefined,
    });
  }
  return rows;
}

async function collectCurrentApiRows(root: string, summaryRoot: string, yamlExtension: string, htmlExtension: string): Promise<CurrentApiRow[]> {
  const names = await getDirectSubdirectoryNames(root);
  const rows: CurrentApiRow[] = [];
  for (const name of names.sort()) {
    const dir = path.join(root, name);
    const yamlPath = path.join(dir, `${name}.${yamlExtension}`);
    const htmlPath = path.join(dir, `${name}.${htmlExtension}`);
    const yamlExists = await pathExists(yamlPath);
    const htmlExists = await pathExists(htmlPath);
    if (!yamlExists && !htmlExists) continue;
    const createdDate = await getCreatedDateString(yamlExists ? yamlPath : htmlPath);
    rows.push({
      name,
      createdDate,
      yaml: yamlExists ? { label: path.basename(yamlPath), href: toRelativeLink(summaryRoot, yamlPath) } : undefined,
      html: htmlExists ? { label: path.basename(htmlPath), href: toRelativeLink(summaryRoot, htmlPath) } : undefined,
    });
  }
  return rows;
}

export async function collectCurrentOpenApiSummaryRows(): Promise<CurrentApiRow[]> {
  return collectCurrentApiRows(PATHS.currentOpenApis, PATHS.currentRoot, "openapi.yaml", "openapi.html");
}

export async function collectCurrentAsyncApiSummaryRows(): Promise<CurrentApiRow[]> {
  return collectCurrentApiRows(PATHS.currentAsyncApis, PATHS.currentRoot, "asyncapi.yaml", "asyncapi.html");
}
