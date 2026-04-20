import path from "node:path";
import { PATHS } from "../../core/paths/paths.js";
import { ensureDirectory, getDirectSubdirectoryNames, pathExists } from "../../core/utils/fs-utils.js";
import { writeJsonFile } from "../../core/utils/json-utils.js";
import { writeYamlFile } from "../../core/utils/yaml-utils.js";
import { bundleSchema } from "./bundle-schema.js";
import { createLogger } from "../../core/logging/logger.js";
import { writeCurrentSummary } from "../../summary/write-summary.js";

const logger = createLogger();

export async function buildCurrentSchemas(target: string | "all"): Promise<void> {
  await ensureDirectory(PATHS.currentSchemas);
  const allNames = await getDirectSubdirectoryNames(PATHS.definitionSchemasRoots);
  const names = target === "all" ? allNames : allNames.filter((name) => name === target);
  if (target !== "all" && names.length === 0) throw new Error(`Schema "${target}" not found.`);
  for (const name of names) {
    const rootPath = path.join(PATHS.definitionSchemasRoots, name, `${name}.schema.yaml`);
    if (!(await pathExists(rootPath))) throw new Error(`Missing root schema file: ${rootPath}`);
    logger.info(`Building schema "${name}"`);
    const bundled = await bundleSchema(rootPath);
    const outputDir = path.join(PATHS.currentSchemas, name);
    await ensureDirectory(outputDir);
    await writeJsonFile(path.join(outputDir, `${name}.schema.json`), bundled);
    await writeYamlFile(path.join(outputDir, `${name}.schema.yaml`), bundled);
  }
  await writeCurrentSummary();
}
