console.log(`
npm run schemas
npm run schemas -- <schemaName>

npm run openapis
npm run openapis -- <apiName>

npm run asyncapis
npm run asyncapis -- <apiName>

npm run all

npm run publish:schemas
npm run publish:schemas -- <schemaName>
npm run publish:schemas -- major
npm run publish:schemas -- minor
npm run publish:schemas -- patch
npm run publish:schemas -- <schemaName> major
npm run publish:schemas -- <schemaName> minor
npm run publish:schemas -- <schemaName> patch

npm run publish:openapis
npm run publish:openapis -- <apiName>
npm run publish:openapis -- major
npm run publish:openapis -- minor
npm run publish:openapis -- patch
npm run publish:openapis -- <apiName> major
npm run publish:openapis -- <apiName> minor
npm run publish:openapis -- <apiName> patch

npm run publish:asyncapis
npm run publish:asyncapis -- <apiName>
npm run publish:asyncapis -- major
npm run publish:asyncapis -- minor
npm run publish:asyncapis -- patch
npm run publish:asyncapis -- <apiName> major
npm run publish:asyncapis -- <apiName> minor
npm run publish:asyncapis -- <apiName> patch

npm run publish:all

npm run releasenote:schemas -- <schemaName> <fromVersion> <toVersion>
npm run releasenote:openapis -- <apiName> <fromVersion> <toVersion>
npm run releasenote:asyncapis -- <apiName> <fromVersion> <toVersion>

npm run summary
`);