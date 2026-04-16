import {
  bundleAsyncApi,
  generateAsyncApiHtmlToFile,
} from "./utils/build-api-docs.mjs";

import { PATHS } from "./utils/project-paths.mjs";
import { parsePublishArguments } from "./utils/publish-version-utils.mjs";
import { publishApis } from "./utils/publish-api-docs.mjs";

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
  requestedApiName: artifactName,
  bumpType,
});
