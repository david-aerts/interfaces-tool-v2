// scripts/utils/publish-api-docs.mjs

import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

import {
  ensureDirectory,
  getDirectSubdirectoryNames,
  pathExists,
} from "./build-utils.mjs";

import {
  compareVersions,
  getNextVersion,
} from "./publish-version-utils.mjs";

import { PATHS } from "./project-paths.mjs";

/**
 * Returns a path with POSIX separators.
 *
 * This keeps generated $ref values consistent in YAML files,
 * even when running on Windows.
 *
 * @param {string} value
 * @returns {string}
 */
function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

/**
 * Returns true when candidatePath is inside parentPath.
 *
 * @param {string} parentPath
 * @param {string} candidatePath
 * @returns {boolean}
 */
function isPathInside(parentPath, candidatePath) {
  const relativePath = path.relative(parentPath, candidatePath);

  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  );
}

/**
 * Recursively walks an object tree.
 *
 * @param {any} node
 * @param {(node: any) => void} visitor
 * @returns {void}
 */
function walkObject(node, visitor) {
  if (Array.isArray(node)) {
    for (const item of node) {
      walkObject(item, visitor);
    }
    return;
  }

  if (!node || typeof node !== "object") {
    return;
  }

  visitor(node);

  for (const value of Object.values(node)) {
    walkObject(value, visitor);
  }
}

/**
 * Reads a YAML file into an object.
 *
 * @param {string} filePath
 * @returns {Promise<object>}
 */
async function readYamlFile(filePath) {
  const fileContent = await fs.readFile(filePath, "utf8");
  return yaml.load(fileContent);
}

/**
 * Writes a YAML object to a file.
 *
 * @param {string} filePath
 * @param {object} value
 * @returns {Promise<void>}
 */
async function writeYamlFile(filePath, value) {
  const content = yaml.dump(value, {
    noRefs: true,
    lineWidth: -1,
  });

  await fs.writeFile(filePath, content, "utf8");
}

/**
 * Removes the version from the API object for comparison.
 *
 * API version changes alone should not force a new publish version.
 *
 * @param {object} apiDocument
 * @returns {object}
 */
function normalizeApiForComparison(apiDocument) {
  const normalized = JSON.parse(JSON.stringify(apiDocument));

  if (normalized.info && typeof normalized.info === "object") {
    delete normalized.info.version;
  }

  return normalized;
}

/**
 * Converts an API document into a canonical comparison string.
 *
 * @param {object} apiDocument
 * @returns {string}
 */
function toComparisonString(apiDocument) {
  return JSON.stringify(normalizeApiForComparison(apiDocument));
}

/**
 * Sets the published version in the API document.
 *
 * @param {object} apiDocument
 * @param {string} version
 * @returns {object}
 */
function setApiVersion(apiDocument, version) {
  const cloned = JSON.parse(JSON.stringify(apiDocument));

  if (!cloned.info || typeof cloned.info !== "object") {
    cloned.info = {};
  }

  cloned.info.version = version;

  return cloned;
}

/**
 * Returns all published API versions found in one directory.
 *
 * @param {string} apiName
 * @param {string} publicationDirectory
 * @param {string} bundledExtension
 * @returns {Promise<string[]>}
 */
async function getPublishedApiVersions(
  apiName,
  publicationDirectory,
  bundledExtension
) {
  const apiDirectory = path.join(publicationDirectory, apiName);

  if (!(await pathExists(apiDirectory))) {
    return [];
  }

  const entries = await fs.readdir(apiDirectory, {
    withFileTypes: true,
  });

  const escapedExtension = bundledExtension.replace(/\./g, "\\.");

  const versions = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .map((fileName) => {
      const match = fileName.match(
        new RegExp(`^${apiName}_v(\\d+\\.\\d+\\.\\d+)\\.${escapedExtension}$`)
      );

      return match ? match[1] : null;
    })
    .filter(Boolean);

  return [...new Set(versions)].sort(compareVersions);
}

/**
 * Returns the latest published API version, or null when none exists.
 *
 * @param {string} apiName
 * @param {string} publicationDirectory
 * @param {string} bundledExtension
 * @returns {Promise<string | null>}
 */
async function getLatestPublishedApiVersion(
  apiName,
  publicationDirectory,
  bundledExtension
) {
  const versions = await getPublishedApiVersions(
    apiName,
    publicationDirectory,
    bundledExtension
  );

  if (versions.length === 0) {
    return null;
  }

  return versions[versions.length - 1];
}

/**
 * Returns the latest published schema version for a schema name.
 *
 * @param {string} schemaName
 * @returns {Promise<string | null>}
 */
async function getLatestPublishedSchemaVersion(schemaName) {
  const schemaDirectory = path.join(PATHS.publishedVersionSchemas, schemaName);

  if (!(await pathExists(schemaDirectory))) {
    return null;
  }

  const entries = await fs.readdir(schemaDirectory, {
    withFileTypes: true,
  });

  const versions = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .map((fileName) => {
      const match = fileName.match(
        new RegExp(
          `^${schemaName}_v(\\d+\\.\\d+\\.\\d+)\\.schema\\.(yaml|json)$`
        )
      );

      return match ? match[1] : null;
    })
    .filter(Boolean);

  if (versions.length === 0) {
    return null;
  }

  return [...new Set(versions)].sort(compareVersions).at(-1) ?? null;
}

/**
 * Validates and interprets one external schema reference.
 *
 * Allowed references:
 * - published-current/schemas/<schema>/<schema>.schema.yaml|json
 * - published-version/schemas/<schema>/<schema>_vX.Y.Z.schema.yaml|json
 *
 * Internal refs like "#/components/..." are ignored.
 *
 * @param {string} apiDefinitionPath
 * @param {string} refValue
 * @returns {Promise<{
 *   type: "internal" | "floating" | "pinned",
 *   schemaName?: string,
 *   extension?: "yaml" | "json",
 *   absolutePath?: string
 * }>}
 */
async function inspectSchemaRef(apiDefinitionPath, refValue) {
  if (refValue.startsWith("#")) {
    return { type: "internal" };
  }

  const apiDirectory = path.dirname(apiDefinitionPath);
  const absoluteRefPath = path.resolve(apiDirectory, refValue);

  if (isPathInside(PATHS.publishedCurrentSchemas, absoluteRefPath)) {
    const relativeToCurrentRoot = toPosixPath(
      path.relative(PATHS.publishedCurrentSchemas, absoluteRefPath)
    );

    const match = relativeToCurrentRoot.match(
      /^([^/]+)\/([^/]+)\.schema\.(yaml|json)$/
    );

    if (!match) {
      throw new Error(
        `Invalid published-current schema ref "${refValue}". Expected format: published-current/schemas/<schema>/<schema>.schema.yaml|json`
      );
    }

    const schemaNameFromFolder = match[1];
    const schemaNameFromFile = match[2];
    const extension = match[3];

    if (schemaNameFromFolder !== schemaNameFromFile) {
      throw new Error(
        `Invalid published-current schema ref "${refValue}". Folder name and file name must match.`
      );
    }

    return {
      type: "floating",
      schemaName: schemaNameFromFolder,
      extension,
      absolutePath: absoluteRefPath,
    };
  }

  if (isPathInside(PATHS.publishedVersionSchemas, absoluteRefPath)) {
    const relativeToVersionRoot = toPosixPath(
      path.relative(PATHS.publishedVersionSchemas, absoluteRefPath)
    );

    const match = relativeToVersionRoot.match(
      /^([^/]+)\/([^/]+)_v(\d+\.\d+\.\d+)\.schema\.(yaml|json)$/
    );

    if (!match) {
      throw new Error(
        `Invalid published-version schema ref "${refValue}". Expected format: published-version/schemas/<schema>/<schema>_vX.Y.Z.schema.yaml|json`
      );
    }

    const schemaNameFromFolder = match[1];
    const schemaNameFromFile = match[2];

    if (schemaNameFromFolder !== schemaNameFromFile) {
      throw new Error(
        `Invalid published-version schema ref "${refValue}". Folder name and file name must match.`
      );
    }

    if (!(await pathExists(absoluteRefPath))) {
      throw new Error(
        `Pinned published-version schema ref does not exist: ${refValue}`
      );
    }

    return {
      type: "pinned",
      schemaName: schemaNameFromFolder,
      extension: match[4],
      absolutePath: absoluteRefPath,
    };
  }

  throw new Error(
    `Invalid external schema ref "${refValue}". API definitions may only reference published-current/schemas or published-version/schemas.`
  );
}

/**
 * Rewrites floating schema refs to the latest published schema version.
 *
 * Pinned published-version refs are validated and preserved.
 *
 * @param {object} apiDefinition
 * @param {string} apiDefinitionPath
 * @returns {Promise<object>}
 */
async function rewriteSchemaRefs(apiDefinition, apiDefinitionPath) {
  const cloned = JSON.parse(JSON.stringify(apiDefinition));
  const apiDirectory = path.dirname(apiDefinitionPath);

  const pendingNodes = [];

  walkObject(cloned, (node) => {
    if (node && typeof node === "object" && typeof node.$ref === "string") {
      pendingNodes.push(node);
    }
  });

  for (const node of pendingNodes) {
    const refValue = node.$ref;
    const inspection = await inspectSchemaRef(apiDefinitionPath, refValue);

    if (inspection.type === "internal") {
      continue;
    }

    if (inspection.type === "pinned") {
      continue;
    }

    const latestSchemaVersion = await getLatestPublishedSchemaVersion(
      inspection.schemaName
    );

    if (!latestSchemaVersion) {
      throw new Error(
        `Schema "${inspection.schemaName}" is referenced by the API but has no published version yet.`
      );
    }

    const targetFilePath = path.join(
      PATHS.publishedVersionSchemas,
      inspection.schemaName,
      `${inspection.schemaName}_v${latestSchemaVersion}.schema.${inspection.extension}`
    );

    if (!(await pathExists(targetFilePath))) {
      throw new Error(
        `Latest published schema file does not exist for "${inspection.schemaName}": ${targetFilePath}`
      );
    }

    const newRelativeRef = toPosixPath(
      path.relative(apiDirectory, targetFilePath)
    );

    node.$ref = newRelativeRef;
  }

  return cloned;
}

/**
 * Writes a temporary transformed API definition next to the original root file.
 *
 * This is important because bundlers resolve relative $ref values from the
 * location of the root file being bundled.
 *
 * @param {object} apiDefinition
 * @param {string} sourceApiPath
 * @param {string} apiName
 * @param {string} rootExtension
 * @returns {Promise<{ tempFilePath: string }>}
 */
async function writeTemporaryApiDefinition(
  apiDefinition,
  sourceApiPath,
  apiName,
  rootExtension
) {
  const sourceDirectory = path.dirname(sourceApiPath);

  const tempFilePath = path.join(
    sourceDirectory,
    `.${apiName}.publish-temp.${rootExtension}`
  );

  await writeYamlFile(tempFilePath, apiDefinition);

  return { tempFilePath };
}

/**
 * Removes a temporary file.
 *
 * @param {string} filePath
 * @returns {Promise<void>}
 */
async function removeTemporaryFile(filePath) {
  await fs.rm(filePath, { force: true });
}

/**
 * Publishes versioned API artifacts.
 *
 * @param {object} configuration
 * @param {"openapi" | "asyncapi"} configuration.type
 * @param {string} configuration.typeLabel
 * @param {string} configuration.definitionDirectory
 * @param {string} configuration.publicationDirectory
 * @param {string} configuration.rootExtension
 * @param {string} configuration.bundledExtension
 * @param {string} configuration.htmlExtension
 * @param {(rootFilePath: string, outputFilePath: string) => Promise<void>} configuration.bundle
 * @param {(bundledFilePath: string, outputFilePathOrDirectory: string, maybeFileName?: string) => Promise<void>} configuration.generateHtml
 * @param {(args: { apiName: string, previousVersion: string, nextVersion: string, previousYamlPath: string, nextYamlPath: string, releaseNotesDirectory: string }) => Promise<void>} [configuration.generateReleaseNotes]
 * @param {string | null} configuration.requestedApiName
 * @param {"major" | "minor" | "patch"} configuration.bumpType
 * @returns {Promise<void>}
 */
export async function publishApis(configuration) {
  const {
    type,
    typeLabel,
    definitionDirectory,
    publicationDirectory,
    rootExtension,
    bundledExtension,
    htmlExtension,
    bundle,
    generateHtml,
    generateReleaseNotes,
    requestedApiName,
    bumpType,
  } = configuration;

  if (!(await pathExists(definitionDirectory))) {
    throw new Error(`${typeLabel} directory not found: ${definitionDirectory}`);
  }

  await ensureDirectory(publicationDirectory);

  const allApiNames = await getDirectSubdirectoryNames(definitionDirectory);

  const apiNames = requestedApiName
    ? allApiNames.filter((apiName) => apiName === requestedApiName)
    : allApiNames;

  if (requestedApiName && apiNames.length === 0) {
    throw new Error(
      `${typeLabel} "${requestedApiName}" not found in ${definitionDirectory}`
    );
  }

  if (apiNames.length === 0) {
    console.log(`No ${typeLabel} folders found.`);
    return;
  }

  const summaryRows = [];

  for (const apiName of apiNames) {
    const sourceApiPath = path.join(
      definitionDirectory,
      apiName,
      `${apiName}.${rootExtension}`
    );

    if (!(await pathExists(sourceApiPath))) {
      console.error(
        `Failed ${typeLabel} "${apiName}": missing root file ${sourceApiPath}`
      );
      continue;
    }

    let tempFilePath = null;

    try {
      const sourceApiDefinition = await readYamlFile(sourceApiPath);
      const rewrittenApiDefinition = await rewriteSchemaRefs(
        sourceApiDefinition,
        sourceApiPath
      );

      const tempFileInfo = await writeTemporaryApiDefinition(
        rewrittenApiDefinition,
        sourceApiPath,
        apiName,
        rootExtension
      );

      tempFilePath = tempFileInfo.tempFilePath;

      const latestPublishedVersion = await getLatestPublishedApiVersion(
        apiName,
        publicationDirectory,
        bundledExtension
      );

      const apiOutputDirectory = path.join(publicationDirectory, apiName);
      await ensureDirectory(apiOutputDirectory);

      const draftBundledPath = path.join(
        apiOutputDirectory,
        `.${apiName}.draft.${bundledExtension}`
      );

      await bundle(tempFilePath, draftBundledPath);

      const bundledApiDefinition = await readYamlFile(draftBundledPath);
      await fs.rm(draftBundledPath, { force: true });

      if (latestPublishedVersion) {
        const latestPublishedYamlPath = path.join(
          apiOutputDirectory,
          `${apiName}_v${latestPublishedVersion}.${bundledExtension}`
        );

        const latestPublishedApiDefinition = await readYamlFile(
          latestPublishedYamlPath
        );

        const newComparisonString = toComparisonString(bundledApiDefinition);
        const oldComparisonString = toComparisonString(
          latestPublishedApiDefinition
        );

        if (newComparisonString === oldComparisonString) {
          summaryRows.push({
            Type: type,
            Name: apiName,
            "Old Version": latestPublishedVersion,
            "New Version": "-",
          });

          continue;
        }
      }

      const nextVersion = getNextVersion(latestPublishedVersion, bumpType);
      const versionedApiDefinition = setApiVersion(
        bundledApiDefinition,
        nextVersion
      );

      const finalYamlPath = path.join(
        apiOutputDirectory,
        `${apiName}_v${nextVersion}.${bundledExtension}`
      );

      await writeYamlFile(finalYamlPath, versionedApiDefinition);

      if (type === "openapi") {
        const htmlOutputPath = path.join(
          apiOutputDirectory,
          `${apiName}_v${nextVersion}.${htmlExtension}`
        );

        await generateHtml(finalYamlPath, htmlOutputPath);
      } else {
        await generateHtml(
          finalYamlPath,
          apiOutputDirectory,
          `${apiName}_v${nextVersion}.${htmlExtension}`
        );
      }

      if (latestPublishedVersion && typeof generateReleaseNotes === "function") {
        const previousYamlPath = path.join(
          apiOutputDirectory,
          `${apiName}_v${latestPublishedVersion}.${bundledExtension}`
        );

        await generateReleaseNotes({
          apiName,
          previousVersion: latestPublishedVersion,
          nextVersion,
          previousYamlPath,
          nextYamlPath: finalYamlPath,
          releaseNotesDirectory: path.join(apiOutputDirectory, "release-notes"),
        });
      }

      summaryRows.push({
        Type: type,
        Name: apiName,
        "Old Version": latestPublishedVersion ?? "-",
        "New Version": nextVersion,
      });
    } catch (error) {
      console.error(`Failed ${typeLabel} "${apiName}": ${error.message}`);
      process.exitCode = 1;
    } finally {
      if (tempFilePath) {
        await removeTemporaryFile(tempFilePath);
      }
    }
  }

  if (summaryRows.length > 0) {
    console.log(`\n${typeLabel} publication summary:\n`);
    console.table(summaryRows);
  }
}