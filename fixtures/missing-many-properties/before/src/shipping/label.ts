// `ShipmentLabel` grew from a two-field stub into the carrier's full payload
// when international shipping landed. Three construction sites still build the
// stub, six required fields short — which is one field past the point where
// TypeScript stops listing them and switches from TS2739 to TS2740.
export interface ShipmentLabel {
  carrier: string;
  tracking: string;
  weightGrams: number;
  originPostcode: string;
  destinationPostcode: string;
  service: "standard" | "express";
  insuredCents: number;
  signatureRequired: boolean;
}
