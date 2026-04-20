export interface LinkItem {
  label: string;
  href: string;
}

export interface CurrentSchemaRow {
  name: string;
  createdDate: string;
  json?: LinkItem;
  yaml?: LinkItem;
}

export interface PublishedSchemaRow extends CurrentSchemaRow {
  version: string;
  releaseNotes?: LinkItem;
}

export interface CurrentApiRow {
  name: string;
  createdDate: string;
  yaml?: LinkItem;
  html?: LinkItem;
}

export interface PublishedApiRow extends CurrentApiRow {
  version: string;
  releaseNotes?: LinkItem;
}
