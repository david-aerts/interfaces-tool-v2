export function currentSchemaYaml(name: string): string { return `${name}.schema.yaml`; }
export function currentSchemaJson(name: string): string { return `${name}.schema.json`; }

export function publishedSchemaYaml(name: string, version: string): string { return `${name}_v${version}.schema.yaml`; }
export function publishedSchemaJson(name: string, version: string): string { return `${name}_v${version}.schema.json`; }

export function currentOpenApiYaml(name: string): string { return `${name}.openapi.yaml`; }
export function currentOpenApiHtml(name: string): string { return `${name}.openapi.html`; }
export function publishedOpenApiYaml(name: string, version: string): string { return `${name}_v${version}.openapi.yaml`; }
export function publishedOpenApiHtml(name: string, version: string): string { return `${name}_v${version}.openapi.html`; }

export function currentAsyncApiYaml(name: string): string { return `${name}.asyncapi.yaml`; }
export function currentAsyncApiHtml(name: string): string { return `${name}.asyncapi.html`; }
export function publishedAsyncApiYaml(name: string, version: string): string { return `${name}_v${version}.asyncapi.yaml`; }
export function publishedAsyncApiHtml(name: string, version: string): string { return `${name}_v${version}.asyncapi.html`; }

export function releaseNotesBaseName(name: string, version: string): string { return `${name}_v${version}.release-notes`; }
export function diffBaseName(name: string, fromVersion: string, toVersion: string): string {
  return `${name}_v${fromVersion}_to_v${toVersion}.diff`;
}
