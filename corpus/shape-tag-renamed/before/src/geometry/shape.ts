// The discriminated union for 2D shapes.
//
// NOTE (refactor): the discriminant tag was renamed from `kind` to `variant`
// across every member below. Consumers elsewhere in the tree were not updated.
export interface Circle {
  variant: "circle";
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface Square {
  variant: "square";
  id: string;
  x: number;
  y: number;
  side: number;
}

export interface Triangle {
  variant: "triangle";
  id: string;
  x: number;
  y: number;
  base: number;
  height: number;
}

export type Shape = Circle | Square | Triangle;

export type ShapeVariant = Shape["variant"];
