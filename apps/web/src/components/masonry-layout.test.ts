import { describe, expect, it } from "vitest";
import { packMasonryItems } from "./masonry-layout";

describe("packMasonryItems", () => {
  it("moves later cards upward to close holes after a shrink", () => {
    const packed = packMasonryItems(
      [
        { id: "hero", width: 520, height: 240 },
        { id: "anomalies", width: 320, height: 220 },
        { id: "traffic", width: 320, height: 220 },
      ],
      { width: 960, gutter: 20 },
    );

    expect(packed.map((item) => ({ id: item.id, x: item.x, y: item.y }))).toEqual([
      { id: "hero", x: 0, y: 0 },
      { id: "anomalies", x: 540, y: 0 },
      { id: "traffic", x: 540, y: 240 },
    ]);
  });

  it("recomputes positions when the first card shrinks and fills the earliest available slot", () => {
    const packed = packMasonryItems(
      [
        { id: "hero", width: 360, height: 240 },
        { id: "anomalies", width: 320, height: 220 },
        { id: "traffic", width: 320, height: 220 },
      ],
      { width: 960, gutter: 20 },
    );

    expect(packed.map((item) => ({ id: item.id, x: item.x, y: item.y }))).toEqual([
      { id: "hero", x: 0, y: 0 },
      { id: "anomalies", x: 380, y: 0 },
      { id: "traffic", x: 380, y: 240 },
    ]);
  });

  it("returns packed workspace height from the lowest occupied edge", () => {
    const packed = packMasonryItems(
      [
        { id: "a", width: 420, height: 240 },
        { id: "b", width: 420, height: 300 },
      ],
      { width: 920, gutter: 20 },
    );

    expect(packed.height).toBe(300);
  });
});
