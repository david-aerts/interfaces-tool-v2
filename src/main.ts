import { parseCommand } from "./core/cli/parse-command.js";
import { createLogger } from "./core/logging/logger.js";
import { buildCurrentSchemas } from "./artifacts/schemas/build-current-schemas.js";
import { buildCurrentOpenApis } from "./artifacts/openapis/build-current-openapis.js";
import { buildCurrentAsyncApis } from "./artifacts/asyncapis/build-current-asyncapis.js";
import { publishSchemas } from "./artifacts/schemas/publish-schemas.js";
import { publishOpenApis } from "./artifacts/openapis/publish-openapis.js";
import { publishAsyncApis } from "./artifacts/asyncapis/publish-asyncapis.js";
import { diffSchemas } from "./artifacts/schemas/diff-schemas.js";
import { diffOpenApis } from "./artifacts/openapis/diff-openapis.js";
import { diffAsyncApis } from "./artifacts/asyncapis/diff-asyncapis.js";

const logger = createLogger();

async function run(): Promise<void> {
  const command = parseCommand(process.argv.slice(2));

  if (command.workflow === "build") {
    if (command.artifact === "all") {
      await buildCurrentSchemas("all");
      await buildCurrentOpenApis("all");
      await buildCurrentAsyncApis("all");
      return;
    }
    if (command.artifact === "schema") return buildCurrentSchemas(command.target);
    if (command.artifact === "openapi") return buildCurrentOpenApis(command.target);
    return buildCurrentAsyncApis(command.target);
  }

  if (command.workflow === "publish") {
    if (command.artifact === "all") {
      await publishSchemas("all", command.bump);
      await publishOpenApis("all", command.bump);
      await publishAsyncApis("all", command.bump);
      return;
    }
    if (command.artifact === "schema") return publishSchemas(command.target, command.bump);
    if (command.artifact === "openapi") return publishOpenApis(command.target, command.bump);
    return publishAsyncApis(command.target, command.bump);
  }

  if (command.workflow === "tool" && command.tool === "diff") {
    if (command.artifact === "schema") return diffSchemas(command.name, command.fromVersion, command.toVersion);
    if (command.artifact === "openapi") return diffOpenApis(command.name, command.fromVersion, command.toVersion);
    return diffAsyncApis(command.name, command.fromVersion, command.toVersion);
  }
}

run().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
