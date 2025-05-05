export interface SzuruResponse {
  query: string;
  offset: number;
  limit: number;
  total: number;
  results: SzuruTag[];
}

export interface SzuruTag {
  names: string[],
  category: string,
  description?: string,
  creationTime: string   // Type casting to string so we can convert it from a known type (string) later
  suggestions: {
    names: string[],
    category: string,
    usages: number,
  }[],
  implications: {
    names: string[],
    category: string,
    usages: number,
  }[],
}