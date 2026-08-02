import type { ShipmentLabel } from "./label";

// Two variable declarations and one return statement: the two node shapes the
// TS2739/2740/2741 resolver has to handle, in one file.
export const placeholder: ShipmentLabel = { carrier: "acme", tracking: "" };

export function relabel(tracking: string): ShipmentLabel {
  return { carrier: "acme", tracking };
}

export const sample: ShipmentLabel = { carrier: "dhl", tracking: "TEST0001" };
