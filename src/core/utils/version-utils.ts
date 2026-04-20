import { BumpType } from "../cli/command-types.js";

export function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version "${version}". Expected X.Y.Z`);
  }
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

export function bumpVersion(previousVersion: string, bumpType: BumpType): string {
  const version = parseVersion(previousVersion);
  if (bumpType === "major") {
    version.major += 1; version.minor = 0; version.patch = 0;
  } else if (bumpType === "minor") {
    version.minor += 1; version.patch = 0;
  } else {
    version.patch += 1;
  }
  return `${version.major}.${version.minor}.${version.patch}`;
}

export function getNextVersion(latestVersion: string | null, bumpType: BumpType): string {
  if (!latestVersion) return "1.0.0";
  return bumpVersion(latestVersion, bumpType);
}
