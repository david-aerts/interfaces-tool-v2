import fs from "node:fs/promises";
import path from "node:path";
import { PATHS } from "../../core/paths/paths.js";
import { ensureDirectory, getDirectSubdirectoryNames, pathExists } from "../../core/utils/fs-utils.js";
import { writeJsonFile } from "../../core/utils/json-utils.js";
import { writeYamlFile, readYamlFile } from "../../core/utils/yaml-utils.js";
import { compareVersions, getNextVersion } from "../../core/utils/version-utils.js";
import { bundleSchema } from "./bundle-schema.js";
import { generateSchemaReleaseNotes } from "../../releasenotes/diff-schemas-release-notes.js";
import { writeReleaseNotes } from "../../releasenotes/write-release-notes.js";
import { writePublishedSummary } from "../../summary/write-summary.js";

function stripVersionSuffixFromTitle(title: string): string {
  return title.replace(/\sv\d+\.\d+\.\d+$/, "");
}

function normalizeSchemaForComparison(schemaObject: any): any {
  const normalized = JSON.parse(JSON.stringify(schemaObject));
  if (typeof normalized.title === "string") normalized.title = stripVersionSuffixFromTitle(normalized.title);
  return normalized;
}

function toComparisonString(schemaObject: any): string {
  return JSON.stringify(normalizeSchemaForComparison(schemaObject));
}

function addVersionToRootTitle(schemaObject: any, modelName: string, version: string): any {
  const clonedSchema = JSON.parse(JSON.stringify(schemaObject));
  const baseTitle = typeof clonedSchema.title === "string" && clonedSchema.title.trim()
    ? stripVersionSuffixFromTitle(clonedSchema.title)
    : modelName;
  clonedSchema.title = `${baseTitle} v${version}`;
  return clonedSchema;
}

async function getLatestPublishedVersion(modelName: string): Promise<string | null> {
  const dir = path.join(PATHS.publishedSchemas, modelName);
  if (!(await pathExists(dir))) return null;
  const entries = await fs.readdir(dir);
  const versions = entries.map((fileName) => {
    const match = fileName.match(new RegExp(`^${modelName}_v(\\d+\\.\\d+\\.\\d+)\\.schema\\.yaml$`));
    return match ? match[1] : null;
  }).filter(Boolean) as string[];
  if (versions.length === 0) return null;
  return [...new Set(versions)].sort(compareVersions).at(-1) ?? null;
}

export async function publishSchemas(target: string | "all", bump: "major" | "minor" | "patch"): Promise<void> {
  await ensureDirectory(PATHS.publishedSchemas);
  const allNames = await getDirectSubdirectoryNames(PATHS.definitionSchemasRoots);
  const names = target === "all" ? allNames : allNames.filter((name) => name === target);
  if (target !== "all" && names.length === 0) throw new Error(`Schema "${target}" not found.`);
  for (const name of names) {
    const rootPath = path.join(PATHS.definitionSchemasRoots, name, `${name}.schema.yaml`);
    const bundled = await bundleSchema(rootPath);
    const latestVersion = await getLatestPublishedVersion(name);
    if (latestVersion) {
      const previousYamlPath = path.join(PATHS.publishedSchemas, name, `${name}_v${latestVersion}.schema.yaml`);
      const previousSchema = await readYamlFile(previousYamlPath);
      if (toComparisonString(previousSchema) === toComparisonString(bundled)) {
        continue;
      }
    }
    const nextVersion = getNextVersion(latestVersion, bump);
    const versioned = addVersionToRootTitle(bundled, name, nextVersion);
    const outDir = path.join(PATHS.publishedSchemas, name);
    await ensureDirectory(outDir);
    await writeJsonFile(path.join(outDir, `${name}_v${nextVersion}.schema.json`), versioned);
    await writeYamlFile(path.join(outDir, `${name}_v${nextVersion}.schema.yaml`), versioned);
    if (latestVersion) {
      const previousYamlPath = path.join(PATHS.publishedSchemas, name, `${name}_v${latestVersion}.schema.yaml`);
      const releaseNotes = await generateSchemaReleaseNotes(name, latestVersion, nextVersion, previousYamlPath, path.join(outDir, `${name}_v${nextVersion}.schema.yaml`));
      await writeReleaseNotes(outDir, `${name}_v${nextVersion}.release-notes`, releaseNotes);
    }
  }
  await writePublishedSummary();
}
