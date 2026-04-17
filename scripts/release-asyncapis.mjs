
import path from "node:path";

import { PATHS } from "./utils/project-paths.mjs";
import { pathExists } from "./utils/build-utils.mjs";
import {
  generateAsyncApiReleaseNotes,
} from "./utils/release-notes/asyncapi-release-notes.mjs";
import { writeApiReleaseNotes } from "./utils/release-notes/api-release-notes-common.mjs";

function parseArguments() {
  const [apiName, fromVersion, toVersion] = process.argv.slice(2);

  if (!apiName || !fromVersion || !toVersion) {
    throw new Error(
      "Usage: npm run release:asyncapis -- <apiName> <fromVersion> <toVersion>"
    );
  }

  return { apiName, fromVersion, toVersion };
}

function getVersionedYamlPath(apiName, version) {
  return path.join(
    PATHS.publishedVersionAsyncApis,
    apiName,
    `${apiName}_v${version}.asyncapi.yaml`
  );
}

async function main() {
  const { apiName, fromVersion, toVersion } = parseArguments();

  const previousYamlPath = getVersionedYamlPath(apiName, fromVersion);
  const nextYamlPath = getVersionedYamlPath(apiName, toVersion);

  if (!(await pathExists(previousYamlPath))) {
    throw new Error(`AsyncAPI version not found: ${previousYamlPath}`);
  }

  if (!(await pathExists(nextYamlPath))) {
    throw new Error(`AsyncAPI version not found: ${nextYamlPath}`);
  }

  const releaseNotes = await generateAsyncApiReleaseNotes(
    apiName,
    fromVersion,
    toVersion,
    previousYamlPath,
    nextYamlPath
  );

  const releaseNotesDirectory = path.join(
    PATHS.publishedVersionAsyncApis,
    apiName,
    "release-notes"
  );

  const fileBaseName = `${apiName}_v${fromVersion}_to_v${toVersion}.release-notes`;

  await writeApiReleaseNotes(releaseNotesDirectory, fileBaseName, releaseNotes);

  console.log(`Created release notes for ${apiName} ${fromVersion} -> ${toVersion}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
