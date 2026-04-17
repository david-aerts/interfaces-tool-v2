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

CREATE SUMMARY HTML
-------------------

  npm run summary

VERSIONED SCHEMA PUBLICATION
----------------------------

Publish all schemas using the default MINOR bump:
  npm run publish:schemas

Publish one schema using the default MINOR bump:
  npm run publish:schemas -- breach

Publish all schemas with a PATCH bump:
  npm run publish:schemas -- patch

Publish all schemas with a MAJOR bump:
  npm run publish:schemas -- major

Publish one schema with a PATCH bump:
  npm run publish:schemas -- breach patch

Publish one schema with a MINOR bump:
  npm run publish:schemas -- breach minor

Publish one schema with a MAJOR bump:
  npm run publish:schemas -- breach major


VERSIONED API PUBLICATION
-------------------------

Publish all OpenAPI definitions using the default MINOR bump:
  npm run publish:openapis

Publish one OpenAPI definition using the default MINOR bump:
  npm run publish:openapis -- sanctioningMain

Publish all OpenAPI definitions with a PATCH bump:
  npm run publish:openapis -- patch

Publish one OpenAPI definition with a MAJOR bump:
  npm run publish:openapis -- sanctioningMain major

Publish all AsyncAPI definitions using the default MINOR bump:
  npm run publish:asyncapis

Publish one AsyncAPI definition using the default MINOR bump:
  npm run publish:asyncapis -- enforcementRecordsPublish

Publish all AsyncAPI definitions with a PATCH bump:
  npm run publish:asyncapis -- patch

Publish one AsyncAPI definition with a MAJOR bump:
  npm run publish:asyncapis -- enforcementRecordsPublish major



ON-DEMAND SCHEMA RELEASE NOTES
-----------------------------

Generate release notes between two published schema versions:
  npm run release:schemas -- breach 1.0.0 1.1.0

OUTPUT FOLDERS
--------------

Latest published non-versioned artifacts:
  published-current/

Published versioned schemas and APIs:
  published-version/
`);


API RELEASE NOTES
-----------------

Generate OpenAPI release notes between two published versions:
  npm run releasenote:openapis -- sanctioningMain 1.0.0 1.1.0

Generate AsyncAPI release notes between two published versions:
  npm run releasenote:asyncapis -- breachesPublish 1.0.0 1.1.0
