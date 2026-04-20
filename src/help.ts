console.log(`
interfaces-tool-v2

Commands

  npm run main -- build schema <name|all>
  npm run main -- build openapi <name|all>
  npm run main -- build asyncapi <name|all>
  npm run main -- build all

  npm run main -- publish schema <name|all> [major|minor|patch]
  npm run main -- publish openapi <name|all> [major|minor|patch]
  npm run main -- publish asyncapi <name|all> [major|minor|patch]
  npm run main -- publish all [major|minor|patch]

  npm run main -- tool diff schema <name> <fromVersion> <toVersion>
  npm run main -- tool diff openapi <name> <fromVersion> <toVersion>
  npm run main -- tool diff asyncapi <name> <fromVersion> <toVersion>

Logging

  Default log level: warn
  Override with:
    LOG_LEVEL=info
    LOG_LEVEL=debug
`);
