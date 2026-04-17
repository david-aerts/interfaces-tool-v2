
import {
  bundleAsyncApi,
  generateAsyncApiHtmlToFile,
} from "./utils/build-api-docs.mjs";

import { PATHS } from "./utils/project-paths.mjs";
import { parsePublishArguments } from "./utils/publish-version-utils.mjs";
import { publishApis } from "./utils/publish-api-docs.mjs";
import {
  generateAsyncApiReleaseNotes,
  writeAsyncApiReleaseNotes,
} from "./utils/release-notes/asyncapi-release-notes.mjs";

const { artifactName, bumpType } = parsePublishArguments();

await publishApis({
  type: "asyncapi",
  typeLabel: "AsyncAPI",
  definitionDirectory: PATHS.definitionAsyncApis,
  publicationDirectory: PATHS.publishedVersionAsyncApis,
  rootExtension: "asyncapi.yaml",
  bundledExtension: "asyncapi.yaml",
  htmlExtension: "asyncapi.html",
  bundle: bundleAsyncApi,
  generateHtml: generateAsyncApiHtmlToFile,
  generateReleaseNotes: async ({
    apiName,
    previousVersion,
    nextVersion,
    previousYamlPath,
    nextYamlPath,
    releaseNotesDirectory,
  }) => {
    const releaseNotes = await generateAsyncApiReleaseNotes(
      apiName,
      previousVersion,
      nextVersion,
      previousYamlPath,
      nextYamlPath
    );

    await writeAsyncApiReleaseNotes(
      releaseNotesDirectory,
      `${apiName}_v${previousVersion}_to_v${nextVersion}.release-notes`,
      releaseNotes
    );
  },
  requestedApiName: artifactName,
  bumpType,
});
