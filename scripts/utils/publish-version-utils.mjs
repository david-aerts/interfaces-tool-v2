/**
 * Supported semantic version bump types.
 */
export const VALID_BUMP_TYPES = new Set(["major", "minor", "patch"]);

/**
 * Parses publish command arguments.
 *
 * Supported forms:
 * - npm run publish:openapis
 * - npm run publish:openapis -- apiName
 * - npm run publish:openapis -- patch
 * - npm run publish:openapis -- apiName major
 *
 * @returns {{
 *   artifactName: string | null,
 *   bumpType: "major" | "minor" | "patch"
 * }}
 */
export function parsePublishArguments() {
  const args = process.argv.slice(2);

  let artifactName = null;
  let bumpType = "minor";

  for (const arg of args) {
    if (VALID_BUMP_TYPES.has(arg)) {
      bumpType = arg;
      continue;
    }

    if (!artifactName) {
      artifactName = arg;
      continue;
    }

    throw new Error(
      `Unexpected argument "${arg}". Expected one artifact name and optionally one bump type: major, minor, or patch.`
    );
  }

  return {
    artifactName,
    bumpType,
  };
}

/**
 * Parses a semantic version string.
 *
 * @param {string} version
 * @returns {{ major: number, minor: number, patch: number }}
 */
export function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    throw new Error(`Invalid version "${version}". Expected X.Y.Z`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * Formats a semantic version object as X.Y.Z.
 *
 * @param {{ major: number, minor: number, patch: number }} version
 * @returns {string}
 */
export function formatVersion(version) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Applies a semantic version bump.
 *
 * @param {string} previousVersion
 * @param {"major" | "minor" | "patch"} bumpType
 * @returns {string}
 */
export function bumpVersion(previousVersion, bumpType) {
  const version = parseVersion(previousVersion);

  if (bumpType === "major") {
    version.major += 1;
    version.minor = 0;
    version.patch = 0;
  } else if (bumpType === "minor") {
    version.minor += 1;
    version.patch = 0;
  } else {
    version.patch += 1;
  }

  return formatVersion(version);
}

/**
 * Compares two semantic versions.
 *
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);

  if (a.major !== b.major) {
    return a.major - b.major;
  }

  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }

  return a.patch - b.patch;
}

/**
 * Returns the next version to publish.
 *
 * Rules:
 * - no existing version => 1.0.0
 * - otherwise apply the requested bump type
 *
 * @param {string | null} latestVersion
 * @param {"major" | "minor" | "patch"} bumpType
 * @returns {string}
 */
export function getNextVersion(latestVersion, bumpType) {
  if (!latestVersion) {
    return "1.0.0";
  }

  return bumpVersion(latestVersion, bumpType);
}
