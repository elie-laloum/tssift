// The barrel, and the single root cause of this fixture.
//
// It used to be `export * from "./order"`. Someone replaced the star with an
// explicit list — a normal, well-intentioned tidy-up — and `OrderId` did not
// make it onto the list. `./order` still exports it; this file no longer does.
//
// Nothing here is a type error: the barrel is valid TypeScript. The three
// modules that import `OrderId` *through* it are where the compiler complains.
export type { Order } from "./order";
export type { Customer, CustomerId } from "./customer";
