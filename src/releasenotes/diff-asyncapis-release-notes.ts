import { readYamlFile } from "../core/utils/yaml-utils.js";
import { ReleaseNoteChange, ReleaseNotes } from "./release-note-types.js";

function isObject(value: any): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeApiDocument(document: any): any {
  const clone = JSON.parse(JSON.stringify(document));
  if (clone?.info && typeof clone.info === "object") delete clone.info.version;
  return clone;
}

function getRefVersion(ref: string): string | null {
  const match = ref.match(/_v(\d+\.\d+\.\d+)\./);
  return match ? match[1] : null;
}

function createChange(change: ReleaseNoteChange): ReleaseNoteChange {
  return change;
}

function compareObjects(previousNode: any, nextNode: any, currentPath: string, changes: ReleaseNoteChange[]): void {
  const previousKeys = isObject(previousNode) ? Object.keys(previousNode) : [];
  const nextKeys = isObject(nextNode) ? Object.keys(nextNode) : [];

  for (const key of nextKeys) {
    const nextValue = nextNode[key];
    const nextPath = `${currentPath}.${key}`;
    if (!(key in (previousNode || {}))) {
      changes.push(createChange({
        artifactType: "asyncapi",
        element: key,
        path: nextPath,
        category: currentPath.includes(".channels") ? "channel-added" : "unclassified-change",
        message: `Added '${key}'.`,
        breaking: false,
      }));
      continue;
    }

    const previousValue = previousNode[key];
    if (JSON.stringify(previousValue) === JSON.stringify(nextValue)) continue;

    if (typeof previousValue === "string" && typeof nextValue === "string" && key === "$ref") {
      const oldVersion = getRefVersion(previousValue);
      const newVersion = getRefVersion(nextValue);
      changes.push(createChange({
        artifactType: "asyncapi",
        element: currentPath.split(".").at(-1) || key,
        path: nextPath,
        category: oldVersion && newVersion && oldVersion !== newVersion ? "schema-version-changed" : "ref-changed",
        message: oldVersion && newVersion && oldVersion !== newVersion
          ? `Schema reference version changed from '${oldVersion}' to '${newVersion}'.`
          : `Reference changed from '${previousValue}' to '${nextValue}'.`,
        breaking: true,
      }));
      continue;
    }

    if (key === "action" && typeof previousValue === "string" && typeof nextValue === "string") {
      changes.push(createChange({
        artifactType: "asyncapi",
        element: currentPath.split(".").at(-1) || key,
        path: nextPath,
        category: "action-changed",
        message: `Action changed from '${previousValue}' to '${nextValue}'.`,
        breaking: true,
      }));
      continue;
    }

    if (isObject(previousValue) && isObject(nextValue)) {
      compareObjects(previousValue, nextValue, nextPath, changes);
      continue;
    }

    changes.push(createChange({
      artifactType: "asyncapi",
      element: key,
      path: nextPath,
      category: "unclassified-change",
      message: `Changed '${key}'.`,
      breaking: true,
    }));
  }

  for (const key of previousKeys) {
    if (!(key in (nextNode || {}))) {
      changes.push(createChange({
        artifactType: "asyncapi",
        element: key,
        path: `${currentPath}.${key}`,
        category: currentPath.includes(".channels") ? "channel-removed" : "unclassified-change",
        message: `Removed '${key}'.`,
        breaking: true,
      }));
    }
  }
}

export async function generateAsyncApiReleaseNotes(artifactName: string, fromVersion: string, toVersion: string, previousYamlPath: string, nextYamlPath: string): Promise<ReleaseNotes> {
  const previousDocument = normalizeApiDocument(await readYamlFile(previousYamlPath));
  const nextDocument = normalizeApiDocument(await readYamlFile(nextYamlPath));
  const changes: ReleaseNoteChange[] = [];
  compareObjects(previousDocument, nextDocument, "$", changes);
  return { artifactType:"asyncapi", artifactName, fromVersion, toVersion, generatedAt:new Date().toISOString(), changes };
}
