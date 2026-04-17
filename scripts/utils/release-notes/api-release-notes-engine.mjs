
import path from "node:path";
import {
  buildReleaseNotes,
  createChange,
  defaultUnclassifiedChange,
  getRefBaseName,
  getRefVersion,
  isObject,
  isVersionedSchemaRef,
  normalizeApiDocument,
  readYaml,
  writeReleaseNotesFiles,
} from "./api-release-notes-common.mjs";

function compareParameterArrays(artifactType, previousParams, nextParams, currentPath, changes) {
  const toKey = (parameter) => `${parameter?.name ?? "?"}|${parameter?.in ?? "?"}`;
  const previousMap = new Map((previousParams || []).map((parameter) => [toKey(parameter), parameter]));
  const nextMap = new Map((nextParams || []).map((parameter) => [toKey(parameter), parameter]));

  for (const [key, nextParameter] of nextMap.entries()) {
    if (!previousMap.has(key)) {
      changes.push(
        createChange({
          artifactType,
          element: nextParameter?.name ?? key,
          path: currentPath,
          category: "parameter-added",
          message: `Parameter '${nextParameter?.name ?? key}' was added.`,
          breaking: Boolean(nextParameter?.required),
        })
      );
      continue;
    }

    const previousParameter = previousMap.get(key);

    if (Boolean(previousParameter?.required) !== Boolean(nextParameter?.required)) {
      changes.push(
        createChange({
          artifactType,
          element: nextParameter?.name ?? key,
          path: `${currentPath}.${nextParameter?.name ?? key}.required`,
          category: Boolean(nextParameter?.required)
            ? "parameter-became-required"
            : "parameter-no-longer-required",
          message: Boolean(nextParameter?.required)
            ? `Parameter '${nextParameter?.name ?? key}' is now required.`
            : `Parameter '${nextParameter?.name ?? key}' is no longer required.`,
          breaking: Boolean(nextParameter?.required),
        })
      );
    }

    if (
      previousParameter?.schema?.$ref &&
      nextParameter?.schema?.$ref &&
      previousParameter.schema.$ref !== nextParameter.schema.$ref
    ) {
      changes.push(buildRefChange(artifactType, nextParameter?.name ?? key, `${currentPath}.${nextParameter?.name ?? key}.schema`, previousParameter.schema.$ref, nextParameter.schema.$ref));
    }
  }

  for (const [key, previousParameter] of previousMap.entries()) {
    if (!nextMap.has(key)) {
      changes.push(
        createChange({
          artifactType,
          element: previousParameter?.name ?? key,
          path: currentPath,
          category: "parameter-removed",
          message: `Parameter '${previousParameter?.name ?? key}' was removed.`,
          breaking: true,
        })
      );
    }
  }
}

function buildRefChange(artifactType, element, currentPath, previousRef, nextRef) {
  const previousBase = getRefBaseName(previousRef);
  const nextBase = getRefBaseName(nextRef);
  const previousVersion = getRefVersion(previousRef);
  const nextVersion = getRefVersion(nextRef);

  if (previousBase === nextBase && previousVersion && nextVersion && previousVersion !== nextVersion) {
    return createChange({
      artifactType,
      element,
      path: currentPath,
      category: "schema-version-changed",
      message: `Schema version changed from '${previousVersion}' to '${nextVersion}'.`,
      breaking: true,
    });
  }

  return createChange({
    artifactType,
    element,
    path: currentPath,
    category: "ref-changed",
    message: `Reference changed from '${previousRef}' to '${nextRef}'.`,
    breaking: true,
  });
}

function shouldIgnoreSchemaInternals(currentPath, artifactType) {
  if (currentPath.startsWith("$.components.schemas")) {
    return true;
  }

  if (artifactType === "asyncapi" && currentPath.endsWith(".payload")) {
    return true;
  }

  if (artifactType === "openapi" && currentPath.endsWith(".schema")) {
    return true;
  }

  return false;
}

function compareNodes(artifactType, previousNode, nextNode, currentPath, element, changes) {
  if (shouldIgnoreSchemaInternals(currentPath, artifactType)) {
    if (
      previousNode?.$ref &&
      nextNode?.$ref &&
      previousNode.$ref !== nextNode.$ref
    ) {
      changes.push(buildRefChange(artifactType, element, currentPath, previousNode.$ref, nextNode.$ref));
    } else if (JSON.stringify(previousNode) !== JSON.stringify(nextNode)) {
      changes.push(
        createChange({
          artifactType,
          element,
          path: currentPath,
          category: "schema-link-changed",
          message: `Linked schema changed.`,
          breaking: true,
        })
      );
    }

    return;
  }

  if (Array.isArray(previousNode) && Array.isArray(nextNode)) {
    if (currentPath.endsWith(".parameters")) {
      compareParameterArrays(artifactType, previousNode, nextNode, currentPath, changes);
      return;
    }

    if (JSON.stringify(previousNode) !== JSON.stringify(nextNode)) {
      changes.push(
        createChange({
          artifactType,
          element,
          path: currentPath,
          category: "unclassified-change",
          message: `Unclassified array change detected.`,
          breaking: true,
        })
      );
    }
    return;
  }

  if (!isObject(previousNode) || !isObject(nextNode)) {
    if (JSON.stringify(previousNode) !== JSON.stringify(nextNode)) {
      changes.push(
        createChange({
          artifactType,
          element,
          path: currentPath,
          category: "unclassified-change",
          message: `Value changed.`,
          breaking: true,
        })
      );
    }
    return;
  }

  const handledKeys = new Set();
  const previousKeys = Object.keys(previousNode);
  const nextKeys = Object.keys(nextNode);

  if (typeof previousNode.$ref === "string" && typeof nextNode.$ref === "string") {
    handledKeys.add("$ref");

    if (previousNode.$ref !== nextNode.$ref) {
      changes.push(buildRefChange(artifactType, element, currentPath, previousNode.$ref, nextNode.$ref));
    }
  }

  if (typeof previousNode.summary === "string" && typeof nextNode.summary === "string") {
    handledKeys.add("summary");
    if (previousNode.summary !== nextNode.summary) {
      changes.push(
        createChange({
          artifactType,
          element,
          path: `${currentPath}.summary`,
          category: "summary-changed",
          message: `Summary changed.`,
          breaking: false,
        })
      );
    }
  }

  if (typeof previousNode.description === "string" && typeof nextNode.description === "string") {
    handledKeys.add("description");
    if (previousNode.description !== nextNode.description) {
      changes.push(
        createChange({
          artifactType,
          element,
          path: `${currentPath}.description`,
          category: "description-changed",
          message: `Description changed.`,
          breaking: false,
        })
      );
    }
  }

  if (typeof previousNode.operationId === "string" && typeof nextNode.operationId === "string") {
    handledKeys.add("operationId");
    if (previousNode.operationId !== nextNode.operationId) {
      changes.push(
        createChange({
          artifactType,
          element,
          path: `${currentPath}.operationId`,
          category: "operation-id-changed",
          message: `Operation ID changed from '${previousNode.operationId}' to '${nextNode.operationId}'.`,
          breaking: true,
        })
      );
    }
  }

  if (typeof previousNode.action === "string" && typeof nextNode.action === "string") {
    handledKeys.add("action");
    if (previousNode.action !== nextNode.action) {
      changes.push(
        createChange({
          artifactType,
          element,
          path: `${currentPath}.action`,
          category: "action-changed",
          message: `Action changed from '${previousNode.action}' to '${nextNode.action}'.`,
          breaking: true,
        })
      );
    }
  }

  if (isObject(previousNode.paths) && isObject(nextNode.paths)) {
    handledKeys.add("paths");
    compareNamedObjectChildren(artifactType, previousNode.paths, nextNode.paths, "$.paths", "path", "path-added", "path-removed", changes);
  }

  if (isObject(previousNode.channels) && isObject(nextNode.channels)) {
    handledKeys.add("channels");
    compareNamedObjectChildren(artifactType, previousNode.channels, nextNode.channels, "$.channels", "channel", "channel-added", "channel-removed", changes);
  }

  if (isObject(previousNode.operations) && isObject(nextNode.operations)) {
    handledKeys.add("operations");
    compareNamedObjectChildren(artifactType, previousNode.operations, nextNode.operations, "$.operations", "operation", "operation-added", "operation-removed", changes);
  }

  if (isObject(previousNode.servers) && isObject(nextNode.servers)) {
    handledKeys.add("servers");
    compareNamedObjectChildren(artifactType, previousNode.servers, nextNode.servers, "$.servers", "server", "server-added", "server-removed", changes);
  }

  if (isObject(previousNode.messages) && isObject(nextNode.messages)) {
    handledKeys.add("messages");
    compareNamedObjectChildren(artifactType, previousNode.messages, nextNode.messages, `${currentPath}.messages`, "message", "message-added", "message-removed", changes);
  }

  if (Array.isArray(previousNode.parameters) && Array.isArray(nextNode.parameters)) {
    handledKeys.add("parameters");
    compareParameterArrays(artifactType, previousNode.parameters, nextNode.parameters, `${currentPath}.parameters`, changes);
  }

  if (isObject(previousNode.responses) && isObject(nextNode.responses)) {
    handledKeys.add("responses");
    compareNamedObjectChildren(artifactType, previousNode.responses, nextNode.responses, `${currentPath}.responses`, "response", "response-added", "response-removed", changes);
  }

  if (isObject(previousNode.requestBody) && isObject(nextNode.requestBody)) {
    handledKeys.add("requestBody");

    if (Boolean(previousNode.requestBody.required) !== Boolean(nextNode.requestBody.required)) {
      changes.push(
        createChange({
          artifactType,
          element,
          path: `${currentPath}.requestBody.required`,
          category: Boolean(nextNode.requestBody.required)
            ? "request-body-became-required"
            : "request-body-no-longer-required",
          message: Boolean(nextNode.requestBody.required)
            ? "Request body is now required."
            : "Request body is no longer required.",
          breaking: Boolean(nextNode.requestBody.required),
        })
      );
    }

    compareNodes(
      artifactType,
      previousNode.requestBody,
      nextNode.requestBody,
      `${currentPath}.requestBody`,
      element,
      changes
    );
  }

  const allKeys = new Set([...previousKeys, ...nextKeys]);

  for (const key of allKeys) {
    if (handledKeys.has(key)) {
      continue;
    }

    const previousHasKey = Object.prototype.hasOwnProperty.call(previousNode, key);
    const nextHasKey = Object.prototype.hasOwnProperty.call(nextNode, key);

    if (!previousHasKey && nextHasKey) {
      changes.push(
        createChange({
          artifactType,
          element: key,
          path: `${currentPath}.${key}`,
          category: "unclassified-change",
          message: `Added '${key}'.`,
          breaking: true,
        })
      );
      continue;
    }

    if (previousHasKey && !nextHasKey) {
      changes.push(
        createChange({
          artifactType,
          element: key,
          path: `${currentPath}.${key}`,
          category: "unclassified-change",
          message: `Removed '${key}'.`,
          breaking: true,
        })
      );
      continue;
    }

    const previousValue = previousNode[key];
    const nextValue = nextNode[key];

    if (JSON.stringify(previousValue) === JSON.stringify(nextValue)) {
      continue;
    }

    if (isObject(previousValue) && isObject(nextValue)) {
      compareNodes(artifactType, previousValue, nextValue, `${currentPath}.${key}`, key, changes);
      continue;
    }

    if (Array.isArray(previousValue) && Array.isArray(nextValue)) {
      compareNodes(artifactType, previousValue, nextValue, `${currentPath}.${key}`, key, changes);
      continue;
    }

    changes.push(defaultUnclassifiedChange(artifactType, key, currentPath, key));
  }
}

function compareNamedObjectChildren(
  artifactType,
  previousMap,
  nextMap,
  currentPath,
  elementLabel,
  addedCategory,
  removedCategory,
  changes
) {
  const previousKeys = Object.keys(previousMap);
  const nextKeys = Object.keys(nextMap);

  for (const name of nextKeys) {
    if (!(name in previousMap)) {
      changes.push(
        createChange({
          artifactType,
          element: name,
          path: `${currentPath}.${name}`,
          category: addedCategory,
          message: `Added ${elementLabel} '${name}'.`,
          breaking: false,
        })
      );
      continue;
    }

    compareNodes(
      artifactType,
      previousMap[name],
      nextMap[name],
      `${currentPath}.${name}`,
      name,
      changes
    );
  }

  for (const name of previousKeys) {
    if (!(name in nextMap)) {
      changes.push(
        createChange({
          artifactType,
          element: name,
          path: `${currentPath}.${name}`,
          category: removedCategory,
          message: `Removed ${elementLabel} '${name}'.`,
          breaking: true,
        })
      );
    }
  }
}

export async function generateApiReleaseNotes({
  artifactType,
  artifactName,
  fromVersion,
  toVersion,
  previousYamlPath,
  nextYamlPath,
}) {
  const previousDocument = normalizeApiDocument(await readYaml(previousYamlPath));
  const nextDocument = normalizeApiDocument(await readYaml(nextYamlPath));

  const changes = [];
  compareNodes(artifactType, previousDocument, nextDocument, "$", artifactName, changes);

  return buildReleaseNotes(artifactType, artifactName, fromVersion, toVersion, changes);
}

export async function writeApiReleaseNotes(outputDirectoryPath, fileBaseName, releaseNotes) {
  await writeReleaseNotesFiles(outputDirectoryPath, fileBaseName, releaseNotes);
}
