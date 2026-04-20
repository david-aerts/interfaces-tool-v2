import $RefParser from "@apidevtools/json-schema-ref-parser";

export async function bundleSchema(rootSchemaPath: string): Promise<any> {
  return $RefParser.bundle(rootSchemaPath);
}
