export type CustomerId = string & { readonly __brand: "CustomerId" };

export interface Customer {
  readonly id: CustomerId;
  readonly name: string;
}
