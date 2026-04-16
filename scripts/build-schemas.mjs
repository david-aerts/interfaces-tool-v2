import fs from "node:fs/promises";
import path from "node:path";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import yaml from "js-yaml";
import {
  ensureDirectory,
  getDirectSubdirectoryNames,
  getRequestedArtifactName,
  pathExists,
} from "./utils/build-utils.mjs";
import { PATHS } from "./utils/project-paths.mjs";

/**
 * Bundles one root schema into a single schema document.
 *
 * External file references are resolved during bundling.
 * Internal references may remain in the generated output.
 *
 * @param {string} rootSchemaPath
 * @returns {Promise<object>}
 */
async function bundleSchema(rootSchemaPath) {
  return $RefParser.bundle(rootSchemaPath);
}

/**
 * Writes one bundled schema in both JSON and YAML formats.
 *
 * @param {object} schemaObject
 * @param {string} modelName
 * @returns {Promise<void>}
 */
async function writeSchemaOutputs(schemaObject, modelName) {
  const outputDir = path.join(PATHS.publishedCurrentSchemas, modelName);
  await ensureDirectory(outputDir);

  const jsonOutputPath = path.join(outputDir, `${modelName}.schema.json`);
  const yamlOutputPath = path.join(outputDir, `${modelName}.schema.yaml`);

  const jsonContent = JSON.stringify(schemaObject, null, 2) + "\n";
  const yamlContent = yaml.dump(schemaObject, {
    noRefs: true,
    lineWidth: -1,
  });

  await fs.writeFile(jsonOutputPath, jsonContent, "utf8");
  await fs.writeFile(yamlOutputPath, yamlContent, "utf8");
}

/**
 * Builds one schema model from its root schema file.
 *
 * @param {string} modelName
 * @returns {Promise<void>}
 */
async function buildOneModel(modelName) {
  const rootSchemaPath = path.join(
    PATHS.definitionSchemasModels,
    modelName,
    `${modelName}.schema.yaml`
  );

  if (!(await pathExists(rootSchemaPath))) {
    console.warn(
      `Skipping "${modelName}": missing root file ${rootSchemaPath}`
    );
    return;
  }

  console.log(`Building schema "${modelName}"`);

  const bundledSchema = await bundleSchema(rootSchemaPath);
  await writeSchemaOutputs(bundledSchema, modelName);

  console.log(`Created: ${path.join(PATHS.publishedCurrentSchemas, modelName)}`);
}

/**
 * Main entry point.
 *
 * Optional usage:
 * - node scripts/build-schemas.mjs
 * - node scripts/build-schemas.mjs enforcementRecord
 *
 * @returns {Promise<void>}
 */
async function main() {
  const requestedModelName = getRequestedArtifactName();

  if (!(await pathExists(PATHS.definitionSchemasModels))) {
    throw new Error(
      `Models directory not found: ${PATHS.definitionSchemasModels}`
    );
  }

  await ensureDirectory(PATHS.publishedCurrentSchemas);

  const allModelNames = await getDirectSubdirectoryNames(
    PATHS.definitionSchemasModels
  );

  const modelNames = requestedModelName
    ? allModelNames.filter((modelName) => modelName === requestedModelName)
    : allModelNames;

  if (requestedModelName && modelNames.length === 0) {
    throw new Error(
      `Schema "${requestedModelName}" not found in ${PATHS.definitionSchemasModels}`
    );
  }

  if (modelNames.length === 0) {
    console.log("No model folders found.");
    return;
  }

  for (const modelName of modelNames) {
    try {
      await buildOneModel(modelName);
    } catch (error) {
      console.error(`Failed schema "${modelName}": ${error.message}`);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
