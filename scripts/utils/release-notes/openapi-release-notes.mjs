
import {
  buildApiReleaseNotes,
  isObject,
  pushUniqueChange,
  readYaml,
} from "./api-release-notes-common.mjs";

/**
 * Removes publication-only noise from the document before diffing.
 *
 * @param {object} document
 * @returns {object}
 */
function normalizeDocument(document) {
  const clone = JSON.parse(JSON.stringify(document));

  if (clone.info && typeof clone.info === "object") {
    delete clone.info.version;
  }

  return clone;
}

/**
 * Creates one normalized change entry.
 *
 * @param {object} options
 * @returns {object}
 */
function createChange(options) {
  return {
    artifactType: "openapi",
    element: options.element,
    path: options.path,
    category: options.category,
    message: options.message,
    breaking: options.breaking,
  };
}

/**
 * Returns a contextual category for added object keys.
 *
 * @param {string} currentPath
 * @param {string} key
 * @returns {{ category: string, breaking: boolean }}
 */
function classifyAddedKey(currentPath, key) {
  if ("openapi" === "openapi") {
    if (currentPath === "$.paths") {
      return { category: "path-added", breaking: false };
    }

    if (/^\$\.paths\.[^.]+$/.test(currentPath)) {
      return { category: "operation-added", breaking: false };
    }

    if (currentPath.endsWith(".parameters")) {
      return { category: "parameter-added", breaking: false };
    }

    if (currentPath.endsWith(".responses")) {
      return { category: "response-added", breaking: false };
    }
  }

  if ("openapi" === "asyncapi") {
    if (currentPath === "$.channels") {
      return { category: "channel-added", breaking: false };
    }

    if (currentPath === "$.operations") {
      return { category: "operation-added", breaking: false };
    }

    if (currentPath.endsWith(".messages")) {
      return { category: "message-added", breaking: false };
    }
  }

  return { category: "unclassified-change", breaking: true };
}

/**
 * Returns a contextual category for removed object keys.
 *
 * @param {string} currentPath
 * @param {string} key
 * @returns {{ category: string, breaking: boolean }}
 */
function classifyRemovedKey(currentPath, key) {
  if ("openapi" === "openapi") {
    if (currentPath === "$.paths") {
      return { category: "path-removed", breaking: true };
    }

    if (/^\$\.paths\.[^.]+$/.test(currentPath)) {
      return { category: "operation-removed", breaking: true };
    }

    if (currentPath.endsWith(".parameters")) {
      return { category: "parameter-removed", breaking: true };
    }

    if (currentPath.endsWith(".responses")) {
      return { category: "response-removed", breaking: true };
    }
  }

  if ("openapi" === "asyncapi") {
    if (currentPath === "$.channels") {
      return { category: "channel-removed", breaking: true };
    }

    if (currentPath === "$.operations") {
      return { category: "operation-removed", breaking: true };
    }

    if (currentPath.endsWith(".messages")) {
      return { category: "message-removed", breaking: true };
    }
  }

  return { category: "unclassified-change", breaking: true };
}

/**
 * Returns a contextual category for value changes.
 *
 * @param {string} currentPath
 * @param {string} key
 * @returns {{ category: string, breaking: boolean }}
 */
function classifyChangedValue(currentPath, key) {
  if (key === "$ref") {
    return { category: "schema-ref-changed", breaking: true };
  }

  if (key === "description") {
    return { category: "description-changed", breaking: false };
  }

  if (key === "summary") {
    return { category: "summary-changed", breaking: false };
  }

  if (key === "deprecated") {
    return { category: "deprecated-changed", breaking: false };
  }

  if ("openapi" === "openapi") {
    if (key === "required" && currentPath.includes(".parameters")) {
      return { category: "parameter-required-changed", breaking: true };
    }

    if (key === "requestBody") {
      return { category: "request-body-changed", breaking: true };
    }
  }

  if ("openapi" === "asyncapi") {
    if (key === "action") {
      return { category: "action-changed", breaking: true };
    }

    if (key === "payload") {
      return { category: "message-payload-changed", breaking: true };
    }
  }

  return { category: "unclassified-change", breaking: true };
}

/**
 * Recursively compares two nodes.
 *
 * No change may remain silent. Any unclassified change is treated as breaking.
 *
 * @param {any} previousNode
 * @param {any} nextNode
 * @param {string} currentPath
 * @param {string} elementName
 * @param {object[]} changes
 * @returns {void}
 */
function diffNodes(previousNode, nextNode, currentPath, elementName, changes) {
  if (Array.isArray(previousNode) && Array.isArray(nextNode)) {
    const previousString = JSON.stringify(previousNode);
    const nextString = JSON.stringify(nextNode);

    if (previousString !== nextString) {
      pushUniqueChange(
        changes,
        createChange({
          element: elementName,
          path: currentPath,
          category: "unclassified-change",
          message: "Array content changed.",
          breaking: true,
        })
      );
    }

    return;
  }

  if (isObject(previousNode) && isObject(nextNode)) {
    const previousKeys = Object.keys(previousNode);
    const nextKeys = Object.keys(nextNode);

    for (const key of nextKeys) {
      const nextPath = `${currentPath}.${key}`;

      if (!Object.prototype.hasOwnProperty.call(previousNode, key)) {
        const classification = classifyAddedKey(currentPath, key);

        pushUniqueChange(
          changes,
          createChange({
            element: key,
            path: nextPath,
            category: classification.category,
            message: `Added '${key}'.`,
            breaking: classification.breaking,
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
        diffNodes(previousValue, nextValue, nextPath, key, changes);
        continue;
      }

      if (Array.isArray(previousValue) && Array.isArray(nextValue)) {
        diffNodes(previousValue, nextValue, nextPath, key, changes);
        continue;
      }

      const classification = classifyChangedValue(currentPath, key);

      pushUniqueChange(
        changes,
        createChange({
          element: key,
          path: nextPath,
          category: classification.category,
          message: `Changed '${key}'.`,
          breaking: classification.breaking,
        })
      );
    }

    for (const key of previousKeys) {
      if (Object.prototype.hasOwnProperty.call(nextNode, key)) {
        continue;
      }

      const classification = classifyRemovedKey(currentPath, key);

      pushUniqueChange(
        changes,
        createChange({
          element: key,
          path: `${currentPath}.${key}`,
          category: classification.category,
          message: `Removed '${key}'.`,
          breaking: classification.breaking,
        })
      );
    }

    return;
  }

  if (JSON.stringify(previousNode) !== JSON.stringify(nextNode)) {
    pushUniqueChange(
      changes,
      createChange({
        element: elementName,
        path: currentPath,
        category: "unclassified-change",
        message: "Value changed.",
        breaking: true,
      })
    );
  }
}

/**
 * Loads two API files, diffs them, and builds release notes.
 *
 * @param {string} artifactName
 * @param {string} fromVersion
 * @param {string} toVersion
 * @param {string} previousYamlPath
 * @param {string} nextYamlPath
 * @returns {Promise<object>}
 */
export async function generateOpenApiReleaseNotes(
  artifactName,
  fromVersion,
  toVersion,
  previousYamlPath,
  nextYamlPath
) {
  const previousDocument = normalizeDocument(await readYaml(previousYamlPath));
  const nextDocument = normalizeDocument(await readYaml(nextYamlPath));

  const changes = [];
  diffNodes(previousDocument, nextDocument, "$", "root", changes);

  return buildApiReleaseNotes(
    "openapi",
    artifactName,
    fromVersion,
    toVersion,
    changes
  );
}
