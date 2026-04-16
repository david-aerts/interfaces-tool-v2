// scripts/publish-schemas.mjs

import fs from "node:fs/promises";
import path from "node:path";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import yaml from "js-yaml";

import {
  ensureDirectory,
  getDirectSubdirectoryNames,
  pathExists,
} from "./utils/build-utils.mjs";

import { PATHS } from "./utils/project-paths.mjs";

/**
 * Supported semantic version bump types.
 */
const VALID_BUMP_TYPES = new Set(["major", "minor", "patch"]);

/**
 * Collects publication results for the final summary table.
 *
 * Only the requested columns are kept:
 * - Type
 * - Name
 * - Old Version
 * - New Version
 *
 * @type {Array<{
 *   Type: string,
 *   Name: string,
 *   "Old Version": string,
 *   "New Version": string
 * }>}
 */
const publicationResults = [];

/**
 * Parses CLI arguments.
 *
 * Supported forms:
 * - npm run publish:schemas
 * - npm run publish:schemas -- breach
 * - npm run publish:schemas -- major
 * - npm run publish:schemas -- breach major
 *
 * Rules:
 * - default bump type is "minor"
 * - if one non-bump argument is present, it is treated as the schema model name
 *
 * @returns {{
 *   modelName: string | null,
 *   bumpType: "major" | "minor" | "patch"
 * }}
 */
function parseArguments() {
  const args = process.argv.slice(2);

  let modelName = null;
  let bumpType = "minor";

  for (const arg of args) {
    if (VALID_BUMP_TYPES.has(arg)) {
      bumpType = arg;
      continue;
    }

    if (!modelName) {
      modelName = arg;
      continue;
    }

    throw new Error(
      `Unexpected argument "${arg}". Expected one schema name and optionally one bump type: major, minor, or patch.`
    );
  }

  return {
    modelName,
    bumpType,
  };
}

/**
 * Returns the root schema file path for a schema model.
 *
 * @param {string} modelName
 * @returns {string}
 */
function getRootSchemaPath(modelName) {
  return path.join(
    PATHS.definitionSchemasModels,
    modelName,
    `${modelName}.schema.yaml`
  );
}

/**
 * Returns the publication directory for a given schema model.
 *
 * @param {string} modelName
 * @returns {string}
 */
function getModelPublicationDirectory(modelName) {
  return path.join(PATHS.publishVersionSchemas, modelName);
}

/**
 * Returns the versioned YAML schema output path.
 *
 * @param {string} modelName
 * @param {string} version
 * @returns {string}
 */
function getVersionedYamlOutputPath(modelName, version) {
  return path.join(
    getModelPublicationDirectory(modelName),
    `${modelName}_v${version}.schema.yaml`
  );
}

/**
 * Returns the versioned JSON schema output path.
 *
 * @param {string} modelName
 * @param {string} version
 * @returns {string}
 */
function getVersionedJsonOutputPath(modelName, version) {
  return path.join(
    getModelPublicationDirectory(modelName),
    `${modelName}_v${version}.schema.json`
  );
}

/**
 * Bundles a schema into a single document.
 *
 * @param {string} rootSchemaPath
 * @returns {Promise<object>}
 */
async function bundleSchema(rootSchemaPath) {
  return $RefParser.bundle(rootSchemaPath);
}

/**
 * Parses a semantic version string.
 *
 * Example:
 * - 1.2.3 -> { major: 1, minor: 2, patch: 3 }
 *
 * @param {string} version
 * @returns {{ major: number, minor: number, patch: number }}
 */
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    throw new Error(`Invalid version "${version}". Expected X.Y.Z`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * Formats a semantic version object.
 *
 * @param {{ major: number, minor: number, patch: number }} version
 * @returns {string}
 */
function formatVersion(version) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Returns the next semantic version based on the requested bump type.
 *
 * @param {string} previousVersion
 * @param {"major" | "minor" | "patch"} bumpType
 * @returns {string}
 */
function bumpVersion(previousVersion, bumpType) {
  const version = parseVersion(previousVersion);

  if (bumpType === "major") {
    version.major += 1;
    version.minor = 0;
    version.patch = 0;
  } else if (bumpType === "minor") {
    version.minor += 1;
    version.patch = 0;
  } else {
    version.patch += 1;
  }

  return formatVersion(version);
}

/**
 * Compares two semantic versions.
 *
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);

  if (a.major !== b.major) {
    return a.major - b.major;
  }

  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }

  return a.patch - b.patch;
}

/**
 * Returns all published versions for one model.
 *
 * Expected file format:
 * <modelName>_vX.Y.Z.schema.yaml
 *
 * @param {string} modelName
 * @returns {Promise<string[]>}
 */
async function getPublishedVersions(modelName) {
  const publicationDirectory = getModelPublicationDirectory(modelName);

  if (!(await pathExists(publicationDirectory))) {
    return [];
  }

  const entries = await fs.readdir(publicationDirectory, {
    withFileTypes: true,
  });

  const versions = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .map((fileName) => {
      const match = fileName.match(
        new RegExp(`^${modelName}_v(\\d+\\.\\d+\\.\\d+)\\.schema\\.yaml$`)
      );

      return match ? match[1] : null;
    })
    .filter(Boolean);

  return [...new Set(versions)].sort(compareVersions);
}

/**
 * Returns the latest published version for a model, or null when none exists.
 *
 * @param {string} modelName
 * @returns {Promise<string | null>}
 */
async function getLatestPublishedVersion(modelName) {
  const versions = await getPublishedVersions(modelName);

  if (versions.length === 0) {
    return null;
  }

  return versions[versions.length - 1];
}

/**
 * Computes the next version to publish.
 *
 * Rules:
 * - no existing version => 1.0.0
 * - otherwise apply the requested bump type
 *
 * @param {string | null} latestVersion
 * @param {"major" | "minor" | "patch"} bumpType
 * @returns {string}
 */
function getNextVersion(latestVersion, bumpType) {
  if (!latestVersion) {
    return "1.0.0";
  }

  return bumpVersion(latestVersion, bumpType);
}

/**
 * Removes a trailing " vX.Y.Z" suffix from the title.
 *
 * @param {string} title
 * @returns {string}
 */
function stripVersionSuffixFromTitle(title) {
  return title.replace(/\sv\d+\.\d+\.\d+$/, "");
}

/**
 * Returns a normalized schema object used for comparison.
 *
 * The version suffix in the root title is intentionally ignored.
 *
 * @param {object} schemaObject
 * @returns {object}
 */
function normalizeSchemaForComparison(schemaObject) {
  const normalized = JSON.parse(JSON.stringify(schemaObject));

  if (typeof normalized.title === "string") {
    normalized.title = stripVersionSuffixFromTitle(normalized.title);
  }

  return normalized;
}

/**
 * Converts a schema object into a canonical comparison string.
 *
 * @param {object} schemaObject
 * @returns {string}
 */
function toComparisonString(schemaObject) {
  return JSON.stringify(normalizeSchemaForComparison(schemaObject));
}

/**
 * Reads a previously published YAML schema file.
 *
 * @param {string} filePath
 * @returns {Promise<object>}
 */
async function readPublishedYamlSchema(filePath) {
  const fileContent = await fs.readFile(filePath, "utf8");
  return yaml.load(fileContent);
}

/**
 * Adds the version suffix to the root title.
 *
 * Example:
 * - breach -> breach v1.2.0
 *
 * @param {object} schemaObject
 * @param {string} modelName
 * @param {string} version
 * @returns {object}
 */
function addVersionToRootTitle(schemaObject, modelName, version) {
  const clonedSchema = JSON.parse(JSON.stringify(schemaObject));

  const baseTitle =
    typeof clonedSchema.title === "string" && clonedSchema.title.trim()
      ? stripVersionSuffixFromTitle(clonedSchema.title)
      : modelName;

  clonedSchema.title = `${baseTitle} v${version}`;

  return clonedSchema;
}

/**
 * Writes the published schema version to YAML and JSON.
 *
 * @param {object} schemaObject
 * @param {string} modelName
 * @param {string} version
 * @returns {Promise<void>}
 */
async function writePublishedSchema(schemaObject, modelName, version) {
  const publicationDirectory = getModelPublicationDirectory(modelName);

  await ensureDirectory(publicationDirectory);

  const yamlOutputPath = getVersionedYamlOutputPath(modelName, version);
  const jsonOutputPath = getVersionedJsonOutputPath(modelName, version);

  const yamlContent = yaml.dump(schemaObject, {
    noRefs: true,
    lineWidth: -1,
  });

  const jsonContent = JSON.stringify(schemaObject, null, 2) + "\n";

  await fs.writeFile(yamlOutputPath, yamlContent, "utf8");
  await fs.writeFile(jsonOutputPath, jsonContent, "utf8");
}

/**
 * Adds one row to the publication summary table.
 *
 * @param {string} modelName
 * @param {string | null} oldVersion
 * @param {string | null} newVersion
 * @returns {void}
 */
function addPublicationResult(modelName, oldVersion, newVersion) {
  publicationResults.push({
    Type: "schema",
    Name: modelName,
    "Old Version": oldVersion ?? "-",
    "New Version": newVersion ?? "-",
  });
}

/**
 * Publishes one schema model if it differs from the latest version.
 *
 * @param {string} modelName
 * @param {"major" | "minor" | "patch"} bumpType
 * @returns {Promise<void>}
 */
async function publishOneModel(modelName, bumpType) {
  const rootSchemaPath = getRootSchemaPath(modelName);

  if (!(await pathExists(rootSchemaPath))) {
    throw new Error(`Missing root schema file: ${rootSchemaPath}`);
  }

  const bundledSchema = await bundleSchema(rootSchemaPath);
  const latestVersion = await getLatestPublishedVersion(modelName);

  if (latestVersion) {
    const latestYamlPath = getVersionedYamlOutputPath(
      modelName,
      latestVersion
    );

    const latestPublishedSchema = await readPublishedYamlSchema(latestYamlPath);

    const latestContent = toComparisonString(latestPublishedSchema);
    const newContent = toComparisonString(bundledSchema);

    if (latestContent === newContent) {
      addPublicationResult(modelName, latestVersion, null);
      return;
    }
  }

  const nextVersion = getNextVersion(latestVersion, bumpType);

  const versionedSchema = addVersionToRootTitle(
    bundledSchema,
    modelName,
    nextVersion
  );

  await writePublishedSchema(versionedSchema, modelName, nextVersion);

  addPublicationResult(modelName, latestVersion, nextVersion);
}

/**
 * Main entry point.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const { modelName: requestedModelName, bumpType } = parseArguments();

  if (!(await pathExists(PATHS.definitionSchemasModels))) {
    throw new Error(
      `Schemas models directory not found: ${PATHS.definitionSchemasModels}`
    );
  }

  await ensureDirectory(PATHS.publishVersionSchemas);

  const allModelNames = await getDirectSubdirectoryNames(
    PATHS.definitionSchemasModels
  );

  const modelNames = requestedModelName
    ? allModelNames.filter((modelName) => modelName === requestedModelName)
    : allModelNames;

  if (requestedModelName && modelNames.length === 0) {
    throw new Error(
      `Schema "${requestedModelName}" was not found in ${PATHS.definitionSchemasModels}`
    );
  }

  if (modelNames.length === 0) {
    console.log("No schema models found.");
    return;
  }

  for (const modelName of modelNames) {
    await publishOneModel(modelName, bumpType);
  }

  console.log("\nSchema publication summary:\n");
  console.table(publicationResults);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});