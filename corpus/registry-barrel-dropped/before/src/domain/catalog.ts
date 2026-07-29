export type Sku = string;

export interface CatalogItem {
  readonly sku: Sku;
  readonly title: string;
}
