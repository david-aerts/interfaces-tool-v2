import path from "node:path";

import { PATHS } from "./utils/project-paths.mjs";
import { pathExists } from "./utils/build-utils.mjs";
import {
  generateSchemaReleaseNotes,
  writeSchemaReleaseNotes,
} from "./utils/release-notes/schema-release-notes.mjs";

/**
 * Parses CLI arguments.
 *
 * Expected usage:
 * - npm run release:schemas -- breach 1.0.0 1.1.0
 *
 * @returns {{ modelName: string, fromVersion: string, toVersion: string }}
 */
function parseArguments() {
  const [modelName, fromVersion, toVersion] = process.argv.slice(2);

  if (!modelName || !fromVersion || !toVersion) {
    throw new Error(
      "Usage: npm run release:schemas -- <schemaName> <fromVersion> <toVersion>"
    );
  }

  return { modelName, fromVersion, toVersion };
}

/**
 * Returns the versioned schema YAML file path.
 *
 * @param {string} modelName
 * @param {string} version
 * @returns {string}
 */
function getVersionedYamlPath(modelName, version) {
  return path.join(
    PATHS.publishedVersionSchemas,
    modelName,
    `${modelName}_v${version}.schema.yaml`
  );
}

/**
 * Main entry point.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const { modelName, fromVersion, toVersion } = parseArguments();

  const previousYamlPath = getVersionedYamlPath(modelName, fromVersion);
  const nextYamlPath = getVersionedYamlPath(modelName, toVersion);

  if (!(await pathExists(previousYamlPath))) {
    throw new Error(`Schema version not found: ${previousYamlPath}`);
  }

  if (!(await pathExists(nextYamlPath))) {
    throw new Error(`Schema version not found: ${nextYamlPath}`);
  }

  const releaseNotes = await generateSchemaReleaseNotes(
    modelName,
    fromVersion,
    toVersion,
    previousYamlPath,
    nextYamlPath
  );

  const releaseNotesDirectory = path.join(
    PATHS.publishedVersionSchemas,
    modelName,
    "release-notes"
  );

  const fileBaseName = `${modelName}_v${fromVersion}_to_v${toVersion}.release-notes`;

  await writeSchemaReleaseNotes(
    releaseNotesDirectory,
    fileBaseName,
    releaseNotes
  );

  console.log(`Created release notes for ${modelName} ${fromVersion} -> ${toVersion}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
