// `Rect` gained `width` and `height` when the layout engine moved from points
// to boxes. The two-field origin shape is still built at three sites.
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
