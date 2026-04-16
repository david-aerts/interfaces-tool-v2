// scripts/utils/project-paths.mjs

import path from "node:path";

const PROJECT_ROOT = process.cwd();

/**
 * Centralized project paths.
 *
 * - "current" is used for the dev build flow
 * - "publish-version" is used for versioned publication
 */
export const PATHS = {
  projectRoot: PROJECT_ROOT,

  definitionSchemasModels: path.join(
    PROJECT_ROOT,
    "definition",
    "schemas",
    "models"
  ),

  definitionOpenApis: path.join(
    PROJECT_ROOT,
    "definition",
    "apis",
    "openApis"
  ),

  definitionAsyncApis: path.join(
    PROJECT_ROOT,
    "definition",
    "apis",
    "asyncApis"
  ),

  currentSchemas: path.join(
    PROJECT_ROOT,
    "published-current",
    "schemas"
  ),

  currentOpenApis: path.join(
    PROJECT_ROOT,
    "published-current",
    "apis",
    "openApis"
  ),

  currentAsyncApis: path.join(
    PROJECT_ROOT,
    "published-current",
    "apis",
    "asyncApis"
  ),

  publishVersionSchemas: path.join(
    PROJECT_ROOT,
    "published-version",
    "schemas"
  ),
};