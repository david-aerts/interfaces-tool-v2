// scripts/build-asyncapis.mjs

import path from "node:path";
import {
  buildApis,
  bundleAsyncApi,
  generateAsyncApiHtml,
} from "./utils/build-api-docs.mjs";

const PROJECT_ROOT = process.cwd();

await buildApis({
  kind: "AsyncAPI",
  sourceDirectory: path.join(
    PROJECT_ROOT,
    "definition",
    "apis",
    "asyncApis"
  ),
  outputDirectory: path.join(
    PROJECT_ROOT,
    "publication",
    "apis",
    "asyncApis"
  ),
  rootExtension: "asyncapi.yaml",
  bundledExtension: "asyncapi.yaml",
  bundle: bundleAsyncApi,
  generateHtml: generateAsyncApiHtml,
});