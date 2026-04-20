import { BumpType, ParsedCommand } from "./command-types.js";

const BUMP_TYPES = new Set<BumpType>(["major", "minor", "patch"]);

export function parseCommand(args: string[]): ParsedCommand {
  const [first, second, third, fourth, fifth] = args;

  if (first === "build") {
    if (second === "all") {
      return { workflow: "build", artifact: "all", target: "all" };
    }
    if (!second || !third) {
      throw new Error("Usage: build schema|openapi|asyncapi <name|all> | build all");
    }
    return {
      workflow: "build",
      artifact: second as ParsedCommand extends never ? never : any,
      target: third as any,
    } as ParsedCommand;
  }

  if (first === "publish") {
    const bump = (fifth || fourth || "minor") as BumpType;
    if (second === "all") {
      const maybeBump = third && BUMP_TYPES.has(third as BumpType) ? (third as BumpType) : "minor";
      return { workflow: "publish", artifact: "all", target: "all", bump: maybeBump };
    }
    if (!second || !third) {
      throw new Error("Usage: publish schema|openapi|asyncapi <name|all> [major|minor|patch] | publish all [major|minor|patch]");
    }
    const maybeBump = fourth && BUMP_TYPES.has(fourth as BumpType) ? (fourth as BumpType) : "minor";
    return {
      workflow: "publish",
      artifact: second as any,
      target: third as any,
      bump: maybeBump,
    } as ParsedCommand;
  }

  if (first === "tool" && second === "diff") {
    if (!third || !fourth || !fifth || !args[5]) {
      throw new Error("Usage: tool diff schema|openapi|asyncapi <name> <fromVersion> <toVersion>");
    }
    return {
      workflow: "tool",
      tool: "diff",
      artifact: third as any,
      name: fourth,
      fromVersion: fifth,
      toVersion: args[5],
    };
  }

  throw new Error("Unknown command. Run npm run help");
}
