export interface FhirBundleEntry {
  fullUrl: string;
  resource: Record<string, unknown>;
  request: {
    method: 'POST' | 'PUT' | 'GET' | 'DELETE';
    url: string;
  };
}

export interface FhirBundle {
  resourceType: 'Bundle';
  id?: string;
  type: 'transaction' | 'batch' | 'document' | 'collection';
  entry: FhirBundleEntry[];
}
