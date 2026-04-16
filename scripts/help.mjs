// scripts/help.mjs

console.log(`
interfaces-tool-v2 commands

DEV BUILD COMMANDS
------------------

Build all current artifacts:
  npm run all

Build all current schemas:
  npm run schemas

Build one current schema:
  npm run schemas -- breach

Build all current OpenAPI definitions:
  npm run openapis

Build one current OpenAPI definition:
  npm run openapis -- sanctioningMain

Build all current AsyncAPI definitions:
  npm run asyncapis

Build one current AsyncAPI definition:
  npm run asyncapis -- enforcementRecordsPublish


VERSIONED SCHEMA PUBLICATION
----------------------------

Publish all schemas using the default MINOR bump:
  npm run publish:schemas

Publish all schemas with a PATCH bump:
  npm run publish:schemas -- patch

Publish all schemas with a MAJOR bump:
  npm run publish:schemas -- major

Publish one schema using the default MINOR bump:
  npm run publish:schemas -- breach

Publish one schema with a PATCH bump:
  npm run publish:schemas -- breach patch

Publish one schema with a MINOR bump:
  npm run publish:schemas -- breach minor

Publish one schema with a MAJOR bump:
  npm run publish:schemas -- breach major


OUTPUT FOLDERS
--------------

Current development output:
  published-current/

Versioned published output:
  published-version/
`);