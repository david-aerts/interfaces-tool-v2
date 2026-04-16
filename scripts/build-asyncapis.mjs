import { getRequestedArtifactName } from "./utils/build-utils.mjs";
import { PATHS } from "./utils/project-paths.mjs";
import {
  buildApis,
  bundleAsyncApi,
  generateAsyncApiHtml,
} from "./utils/build-api-docs.mjs";

const requestedApiName = getRequestedArtifactName();

await buildApis({
  kind: "AsyncAPI",
  sourceDirectory: PATHS.definitionAsyncApis,
  outputDirectory: PATHS.publishedCurrentAsyncApis,
  rootExtension: "asyncapi.yaml",
  bundledExtension: "asyncapi.yaml",
  bundle: bundleAsyncApi,
  generateHtml: generateAsyncApiHtml,
  requestedApiName,
});
