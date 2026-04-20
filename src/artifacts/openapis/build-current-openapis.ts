import path from "node:path";
import { PATHS } from "../../core/paths/paths.js";
import { ensureDirectory, getDirectSubdirectoryNames, pathExists, removeFile } from "../../core/utils/fs-utils.js";
import { bundleOpenApi, buildOpenApiHtml } from "./bundle-openapi.js";
import { prepareOpenApiSource } from "./prepare-openapi-source.js";
import { writeCurrentSummary } from "../../summary/write-summary.js";

export async function buildCurrentOpenApis(target: string | "all"): Promise<void> {
  await ensureDirectory(PATHS.currentOpenApis);
  const allNames = await getDirectSubdirectoryNames(PATHS.definitionOpenApis);
  const names = target === "all" ? allNames : allNames.filter((name) => name === target);
  if (target !== "all" && names.length === 0) throw new Error(`OpenAPI "${target}" not found.`);
  for (const name of names) {
    const sourcePath = path.join(PATHS.definitionOpenApis, name, `${name}.openapi.yaml`);
    if (!(await pathExists(sourcePath))) throw new Error(`Missing root OpenAPI file: ${sourcePath}`);
    const prepared = await prepareOpenApiSource(sourcePath, "build");
    try {
      const outDir = path.join(PATHS.currentOpenApis, name);
      await ensureDirectory(outDir);
      const yamlPath = path.join(outDir, `${name}.openapi.yaml`);
      const htmlPath = path.join(outDir, `${name}.openapi.html`);
      await bundleOpenApi(prepared, yamlPath);
      await buildOpenApiHtml(yamlPath, htmlPath);
    } finally {
      await removeFile(prepared);
    }
  }
  await writeCurrentSummary();
}
