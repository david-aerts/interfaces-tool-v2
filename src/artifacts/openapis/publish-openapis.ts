import fs from "node:fs/promises";
import path from "node:path";
import { PATHS } from "../../core/paths/paths.js";
import { ensureDirectory, getDirectSubdirectoryNames, pathExists, removeFile } from "../../core/utils/fs-utils.js";
import { compareVersions, getNextVersion } from "../../core/utils/version-utils.js";
import { bundleOpenApi, buildOpenApiHtml } from "./bundle-openapi.js";
import { prepareOpenApiSource } from "./prepare-openapi-source.js";
import { readYamlFile, writeYamlFile } from "../../core/utils/yaml-utils.js";
import { generateOpenApiReleaseNotes } from "../../releasenotes/diff-openapis-release-notes.js";
import { writeReleaseNotes } from "../../releasenotes/write-release-notes.js";
import { writePublishedSummary } from "../../summary/write-summary.js";

function normalizeApiForComparison(apiDocument: any): any {
  const normalized = JSON.parse(JSON.stringify(apiDocument));
  if (normalized.info && typeof normalized.info === "object") delete normalized.info.version;
  return normalized;
}
function toComparisonString(apiDocument: any): string {
  return JSON.stringify(normalizeApiForComparison(apiDocument));
}
function setApiVersion(apiDocument: any, version: string): any {
  const cloned = JSON.parse(JSON.stringify(apiDocument));
  if (!cloned.info || typeof cloned.info !== "object") cloned.info = {};
  cloned.info.version = version;
  return cloned;
}
async function getLatestPublishedVersion(apiName: string): Promise<string | null> {
  const dir = path.join(PATHS.publishedOpenApis, apiName);
  if (!(await pathExists(dir))) return null;
  const entries = await fs.readdir(dir);
  const versions = entries.map((fileName) => {
    const match = fileName.match(new RegExp(`^${apiName}_v(\\d+\\.\\d+\\.\\d+)\\.openapi\\.yaml$`));
    return match ? match[1] : null;
  }).filter(Boolean) as string[];
  if (versions.length===0) return null;
  return [...new Set(versions)].sort(compareVersions).at(-1) ?? null;
}

export async function publishOpenApis(target: string | "all", bump: "major" | "minor" | "patch"): Promise<void> {
  await ensureDirectory(PATHS.publishedOpenApis);
  const allNames = await getDirectSubdirectoryNames(PATHS.definitionOpenApis);
  const names = target === "all" ? allNames : allNames.filter((name) => name === target);
  if (target !== "all" && names.length === 0) throw new Error(`OpenAPI "${target}" not found.`);
  for (const name of names) {
    const sourcePath = path.join(PATHS.definitionOpenApis, name, `${name}.openapi.yaml`);
    const prepared = await prepareOpenApiSource(sourcePath, "publish");
    const outDir = path.join(PATHS.publishedOpenApis, name);
    await ensureDirectory(outDir);
    const draftBundledPath = path.join(outDir, `.${name}.draft.openapi.yaml`);
    try {
      await bundleOpenApi(prepared, draftBundledPath);
      const bundled = await readYamlFile(draftBundledPath);
      const latestVersion = await getLatestPublishedVersion(name);
      if (latestVersion) {
        const latestYamlPath = path.join(outDir, `${name}_v${latestVersion}.openapi.yaml`);
        const latestPublished = await readYamlFile(latestYamlPath);
        if (toComparisonString(latestPublished) === toComparisonString(bundled)) continue;
      }
      const nextVersion = getNextVersion(latestVersion, bump);
      const versioned = setApiVersion(bundled, nextVersion);
      const finalYamlPath = path.join(outDir, `${name}_v${nextVersion}.openapi.yaml`);
      await writeYamlFile(finalYamlPath, versioned);
      await buildOpenApiHtml(finalYamlPath, path.join(outDir, `${name}_v${nextVersion}.openapi.html`));
      if (latestVersion) {
        const previousYamlPath = path.join(outDir, `${name}_v${latestVersion}.openapi.yaml`);
        const releaseNotes = await generateOpenApiReleaseNotes(name, latestVersion, nextVersion, previousYamlPath, finalYamlPath);
        await writeReleaseNotes(outDir, `${name}_v${nextVersion}.release-notes`, releaseNotes);
      }
    } finally {
      await removeFile(prepared);
      await removeFile(draftBundledPath);
    }
  }
  await writePublishedSummary();
}
