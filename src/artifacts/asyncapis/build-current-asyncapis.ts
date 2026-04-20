import path from "node:path";
import { PATHS } from "../../core/paths/paths.js";
import { ensureDirectory, getDirectSubdirectoryNames, pathExists, removeFile } from "../../core/utils/fs-utils.js";
import { bundleAsyncApi, buildAsyncApiHtml } from "./bundle-asyncapi.js";
import { prepareAsyncApiSource } from "./prepare-asyncapi-source.js";
import { writeCurrentSummary } from "../../summary/write-summary.js";

export async function buildCurrentAsyncApis(target: string | "all"): Promise<void> {
  await ensureDirectory(PATHS.currentAsyncApis);
  const allNames = await getDirectSubdirectoryNames(PATHS.definitionAsyncApis);
  const names = target === "all" ? allNames : allNames.filter((name) => name === target);
  if (target !== "all" && names.length === 0) throw new Error(`AsyncAPI "${target}" not found.`);
  for (const name of names) {
    const sourcePath = path.join(PATHS.definitionAsyncApis, name, `${name}.asyncapi.yaml`);
    if (!(await pathExists(sourcePath))) throw new Error(`Missing root AsyncAPI file: ${sourcePath}`);
    const prepared = await prepareAsyncApiSource(sourcePath, "build");
    try {
      const outDir = path.join(PATHS.currentAsyncApis, name);
      await ensureDirectory(outDir);
      const yamlPath = path.join(outDir, `${name}.asyncapi.yaml`);
      await bundleAsyncApi(prepared, yamlPath);
      await buildAsyncApiHtml(yamlPath, outDir, `${name}.asyncapi.html`);
    } finally {
      await removeFile(prepared);
    }
  }
  await writeCurrentSummary();
}
