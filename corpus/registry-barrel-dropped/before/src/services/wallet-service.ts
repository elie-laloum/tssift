import type { Money } from "../domain";

export class WalletService {
  private balance: Money;
  constructor(initial: Money) {
    this.balance = initial;
  }
  credit(amount: Money): void {
    this.balance = {
      amountMinor: this.balance.amountMinor + amount.amountMinor,
      currencyCode: this.balance.currencyCode,
    };
  }
  current(): Money {
    return this.balance;
  }
}
