import { readYamlFile } from "../core/utils/yaml-utils.js";
import { ReleaseNoteChange, ReleaseNotes } from "./release-note-types.js";

function isObject(value: any): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stripVersionSuffixFromTitle(title: string): string {
  return title.replace(/\sv\d+\.\d+\.\d+$/, "");
}

function normalizeSchema(schemaObject: any): any {
  const normalized = JSON.parse(JSON.stringify(schemaObject));
  if (typeof normalized.title === "string") {
    normalized.title = stripVersionSuffixFromTitle(normalized.title);
  }
  return normalized;
}

function createChange(change: ReleaseNoteChange): ReleaseNoteChange {
  return change;
}

function compareSchemaNodes(previousNode: any, nextNode: any, currentPath: string, elementName: string, changes: ReleaseNoteChange[]): void {
  if (!isObject(previousNode) || !isObject(nextNode)) return;
  const handledKeys = new Set<string>();

  if ("type" in previousNode && "type" in nextNode) {
    handledKeys.add("type");
    const previousType = JSON.stringify(previousNode.type);
    const nextType = JSON.stringify(nextNode.type);
    if (previousType !== nextType) {
      changes.push(createChange({artifactType:"schema", element:elementName, path:currentPath, category:"type-changed", message:`Type changed from ${previousType} to ${nextType}.`, breaking:true}));
    }
  }

  handledKeys.add("enum");
  const previousEnum = Array.isArray(previousNode.enum) ? previousNode.enum : [];
  const nextEnum = Array.isArray(nextNode.enum) ? nextNode.enum : [];
  for (const value of nextEnum) if (!previousEnum.includes(value)) changes.push(createChange({artifactType:"schema", element:elementName, path:`${currentPath}.enum`, category:"enum-value-added", message:`Enum value '${value}' was added.`, breaking:false}));
  for (const value of previousEnum) if (!nextEnum.includes(value)) changes.push(createChange({artifactType:"schema", element:elementName, path:`${currentPath}.enum`, category:"enum-value-removed", message:`Enum value '${value}' was removed.`, breaking:true}));

  handledKeys.add("required");
  const previousRequired = new Set(Array.isArray(previousNode.required) ? previousNode.required : []);
  const nextRequired = new Set(Array.isArray(nextNode.required) ? nextNode.required : []);
  for (const requiredProperty of nextRequired) if (!previousRequired.has(requiredProperty)) changes.push(createChange({artifactType:"schema", element:requiredProperty, path:`${currentPath}.required`, category:"property-became-required", message:`Property '${requiredProperty}' is now required.`, breaking:true}));
  for (const requiredProperty of previousRequired) if (!nextRequired.has(requiredProperty)) changes.push(createChange({artifactType:"schema", element:requiredProperty, path:`${currentPath}.required`, category:"property-no-longer-required", message:`Property '${requiredProperty}' is no longer required.`, breaking:false}));

  handledKeys.add("properties");
  const previousProperties = isObject(previousNode.properties) ? previousNode.properties : {};
  const nextProperties = isObject(nextNode.properties) ? nextNode.properties : {};
  for (const propertyName of Object.keys(nextProperties)) {
    if (!(propertyName in previousProperties)) {
      const becameRequired = nextRequired.has(propertyName);
      changes.push(createChange({artifactType:"schema", element:propertyName, path:`${currentPath}.properties.${propertyName}`, category:"property-added", message:becameRequired ? `Added required property '${propertyName}'.` : `Added optional property '${propertyName}'.`, breaking:becameRequired}));
      continue;
    }
    compareSchemaNodes(previousProperties[propertyName], nextProperties[propertyName], `${currentPath}.properties.${propertyName}`, propertyName, changes);
  }
  for (const propertyName of Object.keys(previousProperties)) {
    if (!(propertyName in nextProperties)) {
      changes.push(createChange({artifactType:"schema", element:propertyName, path:`${currentPath}.properties.${propertyName}`, category:"property-removed", message:`Removed property '${propertyName}'.`, breaking:true}));
    }
  }

  if (typeof previousNode.$ref === "string" && typeof nextNode.$ref === "string") {
    handledKeys.add("$ref");
    if (previousNode.$ref !== nextNode.$ref) {
      changes.push(createChange({artifactType:"schema", element:elementName, path:currentPath, category:"ref-changed", message:`Reference changed from '${previousNode.$ref}' to '${nextNode.$ref}'.`, breaking:true}));
    }
  }

  const constraintDefinitions = [
    { key: "minimum", category: "minimum-changed", breakingWhen: (before: any, after: any) => after > before },
    { key: "maximum", category: "maximum-changed", breakingWhen: (before: any, after: any) => after < before },
    { key: "exclusiveMinimum", category: "exclusive-minimum-changed", breakingWhen: (before: any, after: any) => after > before },
    { key: "exclusiveMaximum", category: "exclusive-maximum-changed", breakingWhen: (before: any, after: any) => after < before },
    { key: "minLength", category: "min-length-changed", breakingWhen: (before: any, after: any) => after > before },
    { key: "maxLength", category: "max-length-changed", breakingWhen: (before: any, after: any) => after < before },
    { key: "minItems", category: "min-items-changed", breakingWhen: (before: any, after: any) => after > before },
    { key: "maxItems", category: "max-items-changed", breakingWhen: (before: any, after: any) => after < before },
    { key: "pattern", category: "pattern-changed", breakingWhen: () => true },
    { key: "format", category: "format-changed", breakingWhen: () => true },
  ];
  for (const def of constraintDefinitions) {
    handledKeys.add(def.key);
    if (def.key in previousNode && def.key in nextNode && JSON.stringify(previousNode[def.key]) !== JSON.stringify(nextNode[def.key])) {
      changes.push(createChange({artifactType:"schema", element:elementName, path:`${currentPath}.${def.key}`, category:def.category, message:`'${def.key}' changed from '${previousNode[def.key]}' to '${nextNode[def.key]}'.`, breaking:def.breakingWhen(previousNode[def.key], nextNode[def.key])}));
    }
  }

  const metadataDefinitions = [
    { key: "title", category: "title-changed", message: "Title changed." },
    { key: "description", category: "description-changed", message: "Description changed." },
    { key: "default", category: "default-changed", message: "Default value changed." },
    { key: "examples", category: "examples-changed", message: "Examples changed." },
    { key: "example", category: "example-changed", message: "Example changed." },
  ];
  for (const def of metadataDefinitions) {
    handledKeys.add(def.key);
    if (def.key in previousNode && def.key in nextNode && JSON.stringify(previousNode[def.key]) !== JSON.stringify(nextNode[def.key])) {
      changes.push(createChange({artifactType:"schema", element:elementName, path:`${currentPath}.${def.key}`, category:def.category, message:def.message, breaking:false}));
    }
  }

  if (isObject(previousNode.items) && isObject(nextNode.items)) {
    handledKeys.add("items");
    compareSchemaNodes(previousNode.items, nextNode.items, `${currentPath}.items`, `${elementName}[]`, changes);
  }

  for (const key of ["oneOf","anyOf","allOf"]) {
    handledKeys.add(key);
    if (Array.isArray(previousNode[key]) && Array.isArray(nextNode[key]) && JSON.stringify(previousNode[key]) !== JSON.stringify(nextNode[key])) {
      changes.push(createChange({artifactType:"schema", element:elementName, path:`${currentPath}.${key}`, category:`${key.toLowerCase()}-changed`, message:`${key} definition changed.`, breaking:true}));
    }
  }

  handledKeys.add("additionalProperties");
  if ("additionalProperties" in previousNode && "additionalProperties" in nextNode && JSON.stringify(previousNode.additionalProperties) !== JSON.stringify(nextNode.additionalProperties)) {
    const becameStricter = previousNode.additionalProperties === true && nextNode.additionalProperties === false;
    changes.push(createChange({artifactType:"schema", element:elementName, path:`${currentPath}.additionalProperties`, category:"additional-properties-changed", message:`additionalProperties changed from '${previousNode.additionalProperties}' to '${nextNode.additionalProperties}'.`, breaking:becameStricter}));
  }

  const allKeys = new Set([...Object.keys(previousNode), ...Object.keys(nextNode)]);
  for (const key of allKeys) {
    if (handledKeys.has(key)) continue;
    const previousHas = key in previousNode;
    const nextHas = key in nextNode;
    if (!previousHas && nextHas) {
      changes.push(createChange({artifactType:"schema", element:elementName, path:`${currentPath}.${key}`, category:"unclassified-change", message:`Keyword '${key}' was added.`, breaking:true}));
    } else if (previousHas && !nextHas) {
      changes.push(createChange({artifactType:"schema", element:elementName, path:`${currentPath}.${key}`, category:"unclassified-change", message:`Keyword '${key}' was removed.`, breaking:true}));
    } else if (JSON.stringify(previousNode[key]) !== JSON.stringify(nextNode[key])) {
      changes.push(createChange({artifactType:"schema", element:elementName, path:`${currentPath}.${key}`, category:"unclassified-change", message:`Keyword '${key}' changed.`, breaking:true}));
    }
  }
}

export function diffSchemaObjects(previousSchema: any, nextSchema: any): ReleaseNoteChange[] {
  const changes: ReleaseNoteChange[] = [];
  compareSchemaNodes(normalizeSchema(previousSchema), normalizeSchema(nextSchema), "$", "root", changes);
  return changes;
}

export async function generateSchemaReleaseNotes(artifactName: string, fromVersion: string, toVersion: string, previousYamlPath: string, nextYamlPath: string): Promise<ReleaseNotes> {
  const previousSchema = await readYamlFile(previousYamlPath);
  const nextSchema = await readYamlFile(nextYamlPath);
  return {
    artifactType: "schema",
    artifactName,
    fromVersion,
    toVersion,
    generatedAt: new Date().toISOString(),
    changes: diffSchemaObjects(previousSchema, nextSchema),
  };
}
