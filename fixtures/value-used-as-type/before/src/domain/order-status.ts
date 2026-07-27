/**
 * The root cause. `OrderStatus` was an enum and became a const object during
 * the migration off enums, so the name no longer exists in type position. The
 * three annotations below still use it as a type.
 */

export const OrderStatus = {
  Open: "open",
  Closed: "closed",
} as const;
