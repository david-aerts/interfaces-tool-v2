export interface ReleaseNoteChange {
  artifactType: "schema" | "openapi" | "asyncapi";
  element: string;
  path: string;
  category: string;
  message: string;
  breaking: boolean;
}

export interface ReleaseNotes {
  artifactType: "schema" | "openapi" | "asyncapi";
  artifactName: string;
  fromVersion: string;
  toVersion: string;
  generatedAt: string;
  changes: ReleaseNoteChange[];
}
