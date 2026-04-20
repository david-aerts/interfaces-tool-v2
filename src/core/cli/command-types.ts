export type ArtifactKind = "schema" | "openapi" | "asyncapi";
export type Workflow = "build" | "publish" | "tool";
export type BumpType = "major" | "minor" | "patch";

export interface BuildCommand {
  workflow: "build";
  artifact: ArtifactKind | "all";
  target: string | "all";
}

export interface PublishCommand {
  workflow: "publish";
  artifact: ArtifactKind | "all";
  target: string | "all";
  bump: BumpType;
}

export interface DiffCommand {
  workflow: "tool";
  tool: "diff";
  artifact: ArtifactKind;
  name: string;
  fromVersion: string;
  toVersion: string;
}

export type ParsedCommand = BuildCommand | PublishCommand | DiffCommand;
