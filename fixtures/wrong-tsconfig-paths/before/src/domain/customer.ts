export interface Customer {
  id: string;
  displayName: string;
  vatNumber: string | null;
}

export function isVatRegistered(customer: Customer): boolean {
  return customer.vatNumber !== null;
}
