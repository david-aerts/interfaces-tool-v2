import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

/**
 * Returns true when the value is a plain object.
 *
 * @param {any} value
 * @returns {boolean}
 */
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Escapes HTML special characters.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Removes a trailing version suffix from a root schema title.
 *
 * Example:
 * - breach v1.2.0 -> breach
 *
 * @param {string} title
 * @returns {string}
 */
function stripVersionSuffixFromTitle(title) {
  return title.replace(/\sv\d+\.\d+\.\d+$/, "");
}

/**
 * Returns a stable clone of a schema that ignores publication-only noise.
 *
 * At the moment, only the root title version suffix is ignored.
 *
 * @param {object} schemaObject
 * @returns {object}
 */
function normalizeSchema(schemaObject) {
  const normalized = JSON.parse(JSON.stringify(schemaObject));

  if (typeof normalized.title === "string") {
    normalized.title = stripVersionSuffixFromTitle(normalized.title);
  }

  return normalized;
}

/**
 * Creates one normalized schema change entry.
 *
 * @param {object} options
 * @param {string} options.element
 * @param {string} options.path
 * @param {string} options.category
 * @param {string} options.message
 * @param {boolean} options.breaking
 * @returns {object}
 */
function createChange({
  element,
  path,
  category,
  message,
  breaking,
}) {
  return {
    artifactType: "schema",
    element,
    path,
    category,
    message,
    breaking,
  };
}

/**
 * Returns a human-friendly element label for a nested property.
 *
 * @param {string} parentElement
 * @param {string} childName
 * @returns {string}
 */
function childElementName(parentElement, childName) {
  if (!parentElement || parentElement === "root") {
    return childName;
  }

  return `${parentElement}.${childName}`;
}

/**
 * Adds a change only if the exact same change is not already present.
 *
 * @param {object[]} changes
 * @param {object} change
 * @returns {void}
 */
function pushUniqueChange(changes, change) {
  const key = JSON.stringify(change);
  const exists = changes.some((existingChange) => JSON.stringify(existingChange) === key);

  if (!exists) {
    changes.push(change);
  }
}

/**
 * Compares property additions, removals and nested property changes.
 *
 * @param {object} previousNode
 * @param {object} nextNode
 * @param {string} currentPath
 * @param {string} elementName
 * @param {object[]} changes
 * @returns {void}
 */
function compareProperties(previousNode, nextNode, currentPath, elementName, changes) {
  const previousProperties = isObject(previousNode.properties)
    ? previousNode.properties
    : {};

  const nextProperties = isObject(nextNode.properties)
    ? nextNode.properties
    : {};

  const previousRequired = new Set(
    Array.isArray(previousNode.required) ? previousNode.required : []
  );

  const nextRequired = new Set(
    Array.isArray(nextNode.required) ? nextNode.required : []
  );

  for (const propertyName of Object.keys(nextProperties).sort()) {
    const propertyPath = `${currentPath}.properties.${propertyName}`;
    const propertyElement = childElementName(elementName, propertyName);

    if (!Object.prototype.hasOwnProperty.call(previousProperties, propertyName)) {
      const isRequired = nextRequired.has(propertyName);

      pushUniqueChange(
        changes,
        createChange({
          element: propertyElement,
          path: propertyPath,
          category: "property-added",
          message: isRequired
            ? `Added required property '${propertyName}'.`
            : `Added optional property '${propertyName}'.`,
          breaking: isRequired,
        })
      );

      continue;
    }

    compareSchemaNodes(
      previousProperties[propertyName],
      nextProperties[propertyName],
      propertyPath,
      propertyElement,
      changes
    );
  }

  for (const propertyName of Object.keys(previousProperties).sort()) {
    if (!Object.prototype.hasOwnProperty.call(nextProperties, propertyName)) {
      const propertyPath = `${currentPath}.properties.${propertyName}`;
      const propertyElement = childElementName(elementName, propertyName);

      pushUniqueChange(
        changes,
        createChange({
          element: propertyElement,
          path: propertyPath,
          category: "property-removed",
          message: `Removed property '${propertyName}'.`,
          breaking: true,
        })
      );
    }
  }
}

/**
 * Compares required-property changes.
 *
 * @param {object} previousNode
 * @param {object} nextNode
 * @param {string} currentPath
 * @param {string} elementName
 * @param {object[]} changes
 * @returns {void}
 */
function compareRequired(previousNode, nextNode, currentPath, elementName, changes) {
  const previousRequired = new Set(
    Array.isArray(previousNode.required) ? previousNode.required : []
  );

  const nextRequired = new Set(
    Array.isArray(nextNode.required) ? nextNode.required : []
  );

  for (const propertyName of [...nextRequired].sort()) {
    if (!previousRequired.has(propertyName)) {
      pushUniqueChange(
        changes,
        createChange({
          element: childElementName(elementName, propertyName),
          path: `${currentPath}.required`,
          category: "property-became-required",
          message: `Property '${propertyName}' is now required.`,
          breaking: true,
        })
      );
    }
  }

  for (const propertyName of [...previousRequired].sort()) {
    if (!nextRequired.has(propertyName)) {
      pushUniqueChange(
        changes,
        createChange({
          element: childElementName(elementName, propertyName),
          path: `${currentPath}.required`,
          category: "property-no-longer-required",
          message: `Property '${propertyName}' is no longer required.`,
          breaking: false,
        })
      );
    }
  }
}

/**
 * Recursively compares two schema nodes.
 *
 * The function first detects known semantic changes with dedicated categories.
 * It then applies a generic catch-all on any remaining changed keywords so that
 * no schema change is ever silently ignored.
 *
 * @param {object} previousNode
 * @param {object} nextNode
 * @param {string} currentPath
 * @param {string} elementName
 * @param {object[]} changes
 * @returns {void}
 */
function compareSchemaNodes(
  previousNode,
  nextNode,
  currentPath,
  elementName,
  changes
) {
  if (!isObject(previousNode) || !isObject(nextNode)) {
    return;
  }

  /**
   * Tracks keywords already handled by explicit semantic logic,
   * so the generic catch-all does not duplicate them.
   */
  const handledKeys = new Set();

  //
  // type changed
  //
  if (
    Object.prototype.hasOwnProperty.call(previousNode, "type") &&
    Object.prototype.hasOwnProperty.call(nextNode, "type")
  ) {
    handledKeys.add("type");

    const previousType = JSON.stringify(previousNode.type);
    const nextType = JSON.stringify(nextNode.type);

    if (previousType !== nextType) {
      changes.push(
        createChange({
          element: elementName,
          path: currentPath,
          category: "type-changed",
          message: `Type changed from ${previousType} to ${nextType}.`,
          breaking: true,
        })
      );
    }
  }

  //
  // enum changes
  //
  handledKeys.add("enum");

  const previousEnum = Array.isArray(previousNode.enum) ? previousNode.enum : [];
  const nextEnum = Array.isArray(nextNode.enum) ? nextNode.enum : [];

  for (const value of nextEnum) {
    if (!previousEnum.includes(value)) {
      changes.push(
        createChange({
          element: elementName,
          path: `${currentPath}.enum`,
          category: "enum-value-added",
          message: `Enum value '${value}' was added.`,
          breaking: false,
        })
      );
    }
  }

  for (const value of previousEnum) {
    if (!nextEnum.includes(value)) {
      changes.push(
        createChange({
          element: elementName,
          path: `${currentPath}.enum`,
          category: "enum-value-removed",
          message: `Enum value '${value}' was removed.`,
          breaking: true,
        })
      );
    }
  }

  //
  // required changes
  //
  handledKeys.add("required");

  const previousRequired = new Set(
    Array.isArray(previousNode.required) ? previousNode.required : []
  );

  const nextRequired = new Set(
    Array.isArray(nextNode.required) ? nextNode.required : []
  );

  for (const requiredProperty of nextRequired) {
    if (!previousRequired.has(requiredProperty)) {
      changes.push(
        createChange({
          element: requiredProperty,
          path: `${currentPath}.required`,
          category: "property-became-required",
          message: `Property '${requiredProperty}' is now required.`,
          breaking: true,
        })
      );
    }
  }

  for (const requiredProperty of previousRequired) {
    if (!nextRequired.has(requiredProperty)) {
      changes.push(
        createChange({
          element: requiredProperty,
          path: `${currentPath}.required`,
          category: "property-no-longer-required",
          message: `Property '${requiredProperty}' is no longer required.`,
          breaking: false,
        })
      );
    }
  }

  //
  // properties changes
  //
  handledKeys.add("properties");

  const previousProperties = isObject(previousNode.properties)
    ? previousNode.properties
    : {};

  const nextProperties = isObject(nextNode.properties)
    ? nextNode.properties
    : {};

  const previousPropertyNames = Object.keys(previousProperties);
  const nextPropertyNames = Object.keys(nextProperties);

  for (const propertyName of nextPropertyNames) {
    if (!Object.prototype.hasOwnProperty.call(previousProperties, propertyName)) {
      const becameRequired = nextRequired.has(propertyName);

      changes.push(
        createChange({
          element: propertyName,
          path: `${currentPath}.properties.${propertyName}`,
          category: "property-added",
          message: becameRequired
            ? `Added required property '${propertyName}'.`
            : `Added optional property '${propertyName}'.`,
          breaking: becameRequired,
        })
      );

      continue;
    }

    compareSchemaNodes(
      previousProperties[propertyName],
      nextProperties[propertyName],
      `${currentPath}.properties.${propertyName}`,
      propertyName,
      changes
    );
  }

  for (const propertyName of previousPropertyNames) {
    if (!Object.prototype.hasOwnProperty.call(nextProperties, propertyName)) {
      changes.push(
        createChange({
          element: propertyName,
          path: `${currentPath}.properties.${propertyName}`,
          category: "property-removed",
          message: `Removed property '${propertyName}'.`,
          breaking: true,
        })
      );
    }
  }

  //
  // $ref changed
  //
  if (
    typeof previousNode.$ref === "string" &&
    typeof nextNode.$ref === "string"
  ) {
    handledKeys.add("$ref");

    if (previousNode.$ref !== nextNode.$ref) {
      changes.push(
        createChange({
          element: elementName,
          path: currentPath,
          category: "ref-changed",
          message: `Reference changed from '${previousNode.$ref}' to '${nextNode.$ref}'.`,
          breaking: true,
        })
      );
    }
  }

  //
  // common validation constraints
  //
  const constraintDefinitions = [
    {
      key: "minimum",
      category: "minimum-changed",
      breakingWhen: (before, after) => after > before,
    },
    {
      key: "maximum",
      category: "maximum-changed",
      breakingWhen: (before, after) => after < before,
    },
    {
      key: "exclusiveMinimum",
      category: "exclusive-minimum-changed",
      breakingWhen: (before, after) => after > before,
    },
    {
      key: "exclusiveMaximum",
      category: "exclusive-maximum-changed",
      breakingWhen: (before, after) => after < before,
    },
    {
      key: "minLength",
      category: "min-length-changed",
      breakingWhen: (before, after) => after > before,
    },
    {
      key: "maxLength",
      category: "max-length-changed",
      breakingWhen: (before, after) => after < before,
    },
    {
      key: "minItems",
      category: "min-items-changed",
      breakingWhen: (before, after) => after > before,
    },
    {
      key: "maxItems",
      category: "max-items-changed",
      breakingWhen: (before, after) => after < before,
    },
    {
      key: "pattern",
      category: "pattern-changed",
      breakingWhen: () => true,
    },
    {
      key: "format",
      category: "format-changed",
      breakingWhen: () => true,
    },
  ];

  for (const constraintDefinition of constraintDefinitions) {
    const key = constraintDefinition.key;
    handledKeys.add(key);

    if (
      Object.prototype.hasOwnProperty.call(previousNode, key) &&
      Object.prototype.hasOwnProperty.call(nextNode, key) &&
      JSON.stringify(previousNode[key]) !== JSON.stringify(nextNode[key])
    ) {
      changes.push(
        createChange({
          element: elementName,
          path: `${currentPath}.${key}`,
          category: constraintDefinition.category,
          message: `'${key}' changed from '${previousNode[key]}' to '${nextNode[key]}'.`,
          breaking: constraintDefinition.breakingWhen(
            previousNode[key],
            nextNode[key]
          ),
        })
      );
    }
  }

  //
  // metadata / annotation changes
  //
  const metadataDefinitions = [
    {
      key: "title",
      category: "title-changed",
      message: "Title changed.",
    },
    {
      key: "description",
      category: "description-changed",
      message: "Description changed.",
    },
    {
      key: "default",
      category: "default-changed",
      message: "Default value changed.",
    },
    {
      key: "examples",
      category: "examples-changed",
      message: "Examples changed.",
    },
    {
      key: "example",
      category: "example-changed",
      message: "Example changed.",
    },
  ];

  for (const metadataDefinition of metadataDefinitions) {
    const key = metadataDefinition.key;
    handledKeys.add(key);

    if (
      Object.prototype.hasOwnProperty.call(previousNode, key) &&
      Object.prototype.hasOwnProperty.call(nextNode, key) &&
      JSON.stringify(previousNode[key]) !== JSON.stringify(nextNode[key])
    ) {
      changes.push(
        createChange({
          element: elementName,
          path: `${currentPath}.${key}`,
          category: metadataDefinition.category,
          message: metadataDefinition.message,
          breaking: false,
        })
      );
    }
  }

  //
  // items changes
  //
  if (isObject(previousNode.items) && isObject(nextNode.items)) {
    handledKeys.add("items");

    compareSchemaNodes(
      previousNode.items,
      nextNode.items,
      `${currentPath}.items`,
      `${elementName}[]`,
      changes
    );
  }

  //
  // oneOf / anyOf / allOf changes
  //
  const compositionKeys = ["oneOf", "anyOf", "allOf"];

  for (const key of compositionKeys) {
    handledKeys.add(key);

    if (
      Array.isArray(previousNode[key]) &&
      Array.isArray(nextNode[key]) &&
      JSON.stringify(previousNode[key]) !== JSON.stringify(nextNode[key])
    ) {
      changes.push(
        createChange({
          element: elementName,
          path: `${currentPath}.${key}`,
          category: `${key.toLowerCase()}-changed`,
          message: `${key} definition changed.`,
          breaking: true,
        })
      );
    }
  }

  //
  // additionalProperties changed
  //
  handledKeys.add("additionalProperties");

  if (
    Object.prototype.hasOwnProperty.call(previousNode, "additionalProperties") &&
    Object.prototype.hasOwnProperty.call(nextNode, "additionalProperties") &&
    JSON.stringify(previousNode.additionalProperties) !==
      JSON.stringify(nextNode.additionalProperties)
  ) {
    const becameStricter =
      previousNode.additionalProperties === true &&
      nextNode.additionalProperties === false;

    changes.push(
      createChange({
        element: elementName,
        path: `${currentPath}.additionalProperties`,
        category: "additional-properties-changed",
        message: `additionalProperties changed from '${previousNode.additionalProperties}' to '${nextNode.additionalProperties}'.`,
        breaking: becameStricter,
      })
    );
  }

  //
  // catch-all: no silent change allowed
  //
  const allKeys = new Set([
    ...Object.keys(previousNode),
    ...Object.keys(nextNode),
  ]);

  for (const key of allKeys) {
    if (handledKeys.has(key)) {
      continue;
    }

    const previousHasKey = Object.prototype.hasOwnProperty.call(previousNode, key);
    const nextHasKey = Object.prototype.hasOwnProperty.call(nextNode, key);

    if (!previousHasKey && nextHasKey) {
      changes.push(
        createChange({
          element: elementName,
          path: `${currentPath}.${key}`,
          category: "keyword-added",
          message: `Keyword '${key}' was added.`,
          breaking: false,
        })
      );
      continue;
    }

    if (previousHasKey && !nextHasKey) {
      changes.push(
        createChange({
          element: elementName,
          path: `${currentPath}.${key}`,
          category: "keyword-removed",
          message: `Keyword '${key}' was removed.`,
          breaking: false,
        })
      );
      continue;
    }

    if (
      previousHasKey &&
      nextHasKey &&
      JSON.stringify(previousNode[key]) !== JSON.stringify(nextNode[key])
    ) {
      changes.push(
        createChange({
          element: elementName,
          path: `${currentPath}.${key}`,
          category: "keyword-changed",
          message: `Keyword '${key}' changed.`,
          breaking: false,
        })
      );
    }
  }
}

/**
 * Diffs two schema objects and returns semantic changes.
 *
 * @param {object} previousSchema
 * @param {object} nextSchema
 * @returns {object[]}
 */
export function diffSchemas(previousSchema, nextSchema) {
  const previousNormalized = normalizeSchema(previousSchema);
  const nextNormalized = normalizeSchema(nextSchema);

  const changes = [];

  compareSchemaNodes(previousNormalized, nextNormalized, "$", "root", changes);

  return changes;
}

/**
 * Builds the normalized release note object.
 *
 * @param {string} artifactName
 * @param {string} fromVersion
 * @param {string} toVersion
 * @param {object[]} changes
 * @returns {object}
 */
export function buildSchemaReleaseNotes(
  artifactName,
  fromVersion,
  toVersion,
  changes
) {
  return {
    artifactType: "schema",
    artifactName,
    fromVersion,
    toVersion,
    generatedAt: new Date().toISOString(),
    changes,
  };
}

/**
 * Builds markdown release notes.
 *
 * @param {object} releaseNotes
 * @returns {string}
 */
export function buildMarkdown(releaseNotes) {
  const rows = releaseNotes.changes
    .map((change) => {
      return `| ${change.element} | ${change.category} | ${
        change.breaking ? "Yes" : "No"
      } | ${change.message} |`;
    })
    .join("\n");

  return `# Release notes — ${releaseNotes.artifactName} v${releaseNotes.fromVersion} → v${releaseNotes.toVersion}

| Element | Category | Breaking | Message |
|----------|----------|----------|----------|
${rows}
`;
}

/**
 * Builds HTML release notes.
 *
 * @param {object} releaseNotes
 * @returns {string}
 */
export function buildHtml(releaseNotes) {
  const rows = releaseNotes.changes
    .map((change) => {
      return `
        <tr class="${change.breaking ? "breaking" : ""}">
          <td>${escapeHtml(change.element)}</td>
          <td>${escapeHtml(change.category)}</td>
          <td>${change.breaking ? "Yes" : "No"}</td>
          <td>${escapeHtml(change.message)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(
    `${releaseNotes.artifactName} ${releaseNotes.fromVersion} → ${releaseNotes.toVersion}`
  )}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 32px;
    }

    h1 {
      margin-bottom: 8px;
    }

    p {
      color: #666;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin-top: 24px;
    }

    th,
    td {
      border: 1px solid #ccc;
      padding: 10px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: #f4f4f4;
    }

    tr.breaking td {
      background: #ffe9e9;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(releaseNotes.artifactName)}</h1>
  <p>
    Version ${escapeHtml(releaseNotes.fromVersion)}
    → ${escapeHtml(releaseNotes.toVersion)}
  </p>

  <table>
    <thead>
      <tr>
        <th>Element</th>
        <th>Category</th>
        <th>Breaking</th>
        <th>Message</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
}

/**
 * Writes release notes in JSON, Markdown and HTML formats.
 *
 * @param {string} outputDirectoryPath
 * @param {string} fileBaseName
 * @param {object} releaseNotes
 * @returns {Promise<void>}
 */
export async function writeSchemaReleaseNotes(
  outputDirectoryPath,
  fileBaseName,
  releaseNotes
) {
  await fs.mkdir(outputDirectoryPath, { recursive: true });

  await fs.writeFile(
    path.join(outputDirectoryPath, `${fileBaseName}.json`),
    JSON.stringify(releaseNotes, null, 2) + "\n",
    "utf8"
  );

  await fs.writeFile(
    path.join(outputDirectoryPath, `${fileBaseName}.md`),
    buildMarkdown(releaseNotes),
    "utf8"
  );

  await fs.writeFile(
    path.join(outputDirectoryPath, `${fileBaseName}.html`),
    buildHtml(releaseNotes),
    "utf8"
  );
}

/**
 * Loads two schema YAML files, diffs them, and builds release notes.
 *
 * @param {string} artifactName
 * @param {string} fromVersion
 * @param {string} toVersion
 * @param {string} previousYamlPath
 * @param {string} nextYamlPath
 * @returns {Promise<object>}
 */
export async function generateSchemaReleaseNotes(
  artifactName,
  fromVersion,
  toVersion,
  previousYamlPath,
  nextYamlPath
) {
  const previousSchema = yaml.load(await fs.readFile(previousYamlPath, "utf8"));
  const nextSchema = yaml.load(await fs.readFile(nextYamlPath, "utf8"));

  const changes = diffSchemas(previousSchema, nextSchema);

  return buildSchemaReleaseNotes(
    artifactName,
    fromVersion,
    toVersion,
    changes
  );
}
