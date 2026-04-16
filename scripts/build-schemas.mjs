import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import YAML from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, "..");
const MODELS_DIR = path.join(PROJECT_ROOT, "definition", "schemas", "models");
const PUBLICATION_DIR = path.join(PROJECT_ROOT, "publication", "schemas");

/**
 * Return true if the path exists.
 */
async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create directory recursively.
 */
async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Return immediate subdirectories of a directory.
 */
async function getSubdirectories(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

/**
 * Serialize object to pretty JSON.
 */
function toJsonString(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

/**
 * Serialize object to YAML.
 */
function toYamlString(value) {
  return YAML.stringify(value, {
    indent: 2,
    lineWidth: 0
  });
}

/**
 * Bundle a schema root into a standalone schema with internal refs only.
 *
 * Why bundle and not dereference?
 * - bundle() keeps internal $refs and is usually safer for publication
 * - dereference() can expand repeated fragments aggressively
 * - dereference() can also create circular JS object graphs in some cases
 */
async function bundleSchema(rootSchemaPath) {
  return $RefParser.bundle(rootSchemaPath, {
    parse: {
      yaml: true,
      json: true
    },
    resolve: {
      file: true,
      http: false
    },
    dereference: {
      circular: "ignore"
    }
  });
}

/**
 * Build one model schema publication artifact.
 */
async function buildOneModel(modelName) {
  const rootSchemaPath = path.join(
    MODELS_DIR,
    modelName,
    `${modelName}.schema.yaml`
  );

  if (!(await exists(rootSchemaPath))) {
    console.warn(`- Skip "${modelName}": root schema not found at ${rootSchemaPath}`);
    return;
  }

  console.log(`- Building "${modelName}" from ${rootSchemaPath}`);

  const bundledSchema = await bundleSchema(rootSchemaPath);

  const outputDir = path.join(PUBLICATION_DIR, modelName);
  await ensureDir(outputDir);

  const yamlOutputPath = path.join(outputDir, `${modelName}.schema.yaml`);
  const jsonOutputPath = path.join(outputDir, `${modelName}.schema.json`);

  await fs.writeFile(yamlOutputPath, toYamlString(bundledSchema), "utf8");
  await fs.writeFile(jsonOutputPath, toJsonString(bundledSchema), "utf8");

  console.log(`  -> ${yamlOutputPath}`);
  console.log(`  -> ${jsonOutputPath}`);
}

/**
 * Main entrypoint.
 */
async function main() {
  if (!(await exists(MODELS_DIR))) {
    throw new Error(`Models directory not found: ${MODELS_DIR}`);
  }

  await ensureDir(PUBLICATION_DIR);

  const modelNames = await getSubdirectories(MODELS_DIR);

  if (modelNames.length === 0) {
    console.log("No model folders found.");
    return;
  }

  for (const modelName of modelNames) {
    try {
      await buildOneModel(modelName);
    } catch (error) {
      console.error(`x Failed to build "${modelName}"`);
      console.error(error);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error("Fatal error while building schemas.");
  console.error(error);
  process.exit(1);
});