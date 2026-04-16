import fs from "node:fs/promises";
import path from "node:path";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import yaml from "js-yaml";

const PROJECT_ROOT = process.cwd();

const MODELS_DIR = path.join(
  PROJECT_ROOT,
  "definition",
  "schemas",
  "models"
);

const PUBLICATION_DIR = path.join(
  PROJECT_ROOT,
  "publication",
  "schemas"
);

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getDirectSubdirectoryNames(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function bundleSchema(rootSchemaPath) {
  return $RefParser.bundle(rootSchemaPath);
}

async function writeSchemaOutputs(schemaObject, modelName) {
  const outputDir = path.join(PUBLICATION_DIR, modelName);
  await ensureDirectory(outputDir);

  const jsonOutputPath = path.join(outputDir, `${modelName}.schema.json`);
  const yamlOutputPath = path.join(outputDir, `${modelName}.schema.yaml`);

  const jsonContent = JSON.stringify(schemaObject, null, 2) + "\n";
  const yamlContent = yaml.dump(schemaObject, {
    noRefs: true,
    lineWidth: -1
  });

  await fs.writeFile(jsonOutputPath, jsonContent, "utf8");
  await fs.writeFile(yamlOutputPath, yamlContent, "utf8");
}

async function buildOneModel(modelName) {
  const rootSchemaPath = path.join(
    MODELS_DIR,
    modelName,
    `${modelName}.schema.yaml`
  );

  if (!(await pathExists(rootSchemaPath))) {
    console.warn(`Skipping "${modelName}": missing root file ${rootSchemaPath}`);
    return;
  }

  console.log(`Building "${modelName}" from ${rootSchemaPath}`);

  const bundledSchema = await bundleSchema(rootSchemaPath);
  await writeSchemaOutputs(bundledSchema, modelName);

  console.log(`Done "${modelName}"`);
}

async function main() {
  if (!(await pathExists(MODELS_DIR))) {
    throw new Error(`Models directory not found: ${MODELS_DIR}`);
  }

  await ensureDirectory(PUBLICATION_DIR);

  const modelNames = await getDirectSubdirectoryNames(MODELS_DIR);

  if (modelNames.length === 0) {
    console.log("No model folders found.");
    return;
  }

  for (const modelName of modelNames) {
    try {
      await buildOneModel(modelName);
    } catch (error) {
      console.error(`Failed for "${modelName}": ${error.message}`);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});