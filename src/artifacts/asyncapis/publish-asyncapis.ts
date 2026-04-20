import fs from "node:fs/promises";
import path from "node:path";
import { PATHS } from "../../core/paths/paths.js";
import { ensureDirectory, getDirectSubdirectoryNames, pathExists, removeFile } from "../../core/utils/fs-utils.js";
import { compareVersions, getNextVersion } from "../../core/utils/version-utils.js";
import { bundleAsyncApi, buildAsyncApiHtml } from "./bundle-asyncapi.js";
import { prepareAsyncApiSource } from "./prepare-asyncapi-source.js";
import { readYamlFile, writeYamlFile } from "../../core/utils/yaml-utils.js";
import { generateAsyncApiReleaseNotes } from "../../releasenotes/diff-asyncapis-release-notes.js";
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
  const dir = path.join(PATHS.publishedAsyncApis, apiName);
  if (!(await pathExists(dir))) return null;
  const entries = await fs.readdir(dir);
  const versions = entries.map((fileName) => {
    const match = fileName.match(new RegExp(`^${apiName}_v(\\d+\\.\\d+\\.\\d+)\\.asyncapi\\.yaml$`));
    return match ? match[1] : null;
  }).filter(Boolean) as string[];
  if (versions.length===0) return null;
  return [...new Set(versions)].sort(compareVersions).at(-1) ?? null;
}

export async function publishAsyncApis(target: string | "all", bump: "major" | "minor" | "patch"): Promise<void> {
  await ensureDirectory(PATHS.publishedAsyncApis);
  const allNames = await getDirectSubdirectoryNames(PATHS.definitionAsyncApis);
  const names = target === "all" ? allNames : allNames.filter((name) => name === target);
  if (target !== "all" && names.length === 0) throw new Error(`AsyncAPI "${target}" not found.`);
  for (const name of names) {
    const sourcePath = path.join(PATHS.definitionAsyncApis, name, `${name}.asyncapi.yaml`);
    const prepared = await prepareAsyncApiSource(sourcePath, "publish");
    const outDir = path.join(PATHS.publishedAsyncApis, name);
    await ensureDirectory(outDir);
    const draftBundledPath = path.join(outDir, `.${name}.draft.asyncapi.yaml`);
    try {
      await bundleAsyncApi(prepared, draftBundledPath);
      const bundled = await readYamlFile(draftBundledPath);
      const latestVersion = await getLatestPublishedVersion(name);
      if (latestVersion) {
        const latestYamlPath = path.join(outDir, `${name}_v${latestVersion}.asyncapi.yaml`);
        const latestPublished = await readYamlFile(latestYamlPath);
        if (toComparisonString(latestPublished) === toComparisonString(bundled)) continue;
      }
      const nextVersion = getNextVersion(latestVersion, bump);
      const versioned = setApiVersion(bundled, nextVersion);
      const finalYamlPath = path.join(outDir, `${name}_v${nextVersion}.asyncapi.yaml`);
      await writeYamlFile(finalYamlPath, versioned);
      await buildAsyncApiHtml(finalYamlPath, outDir, `${name}_v${nextVersion}.asyncapi.html`);
      if (latestVersion) {
        const previousYamlPath = path.join(outDir, `${name}_v${latestVersion}.asyncapi.yaml`);
        const releaseNotes = await generateAsyncApiReleaseNotes(name, latestVersion, nextVersion, previousYamlPath, finalYamlPath);
        await writeReleaseNotes(outDir, `${name}_v${nextVersion}.release-notes`, releaseNotes);
      }
    } finally {
      await removeFile(prepared);
      await removeFile(draftBundledPath);
    }
  }
  await writePublishedSummary();
}
