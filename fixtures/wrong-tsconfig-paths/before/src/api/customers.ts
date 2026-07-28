import { type Customer, isVatRegistered } from "@domain/customer";

export function customerLabel(customer: Customer): string {
  return isVatRegistered(customer) ? `${customer.displayName} (VAT)` : customer.displayName;
}
