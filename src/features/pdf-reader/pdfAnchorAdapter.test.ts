import { describe, expect, it } from "vitest";
import { denormalizeRect, normalizeRects } from "./pdfAnchorAdapter";

describe("PDF page-relative anchors", () => {
  it("preserves multiple text lines across 75% and 150% zoom and viewport movement", () => {
    const page = { left: 100, top: 50, width: 600, height: 800 };
    const normalized = normalizeRects(
      [
        { left: 160, top: 130, width: 420, height: 16 },
        { left: 160, top: 150, width: 120, height: 16 },
      ],
      page,
    );
    expect(normalized).toEqual([
      { x: 0.1, y: 0.1, width: 0.7, height: 0.02 },
      { x: 0.1, y: 0.125, width: 0.2, height: 0.02 },
    ]);
    for (const scale of [0.75, 1.5]) {
      const resized = {
        left: 23,
        top: 120,
        width: 600 * scale,
        height: 800 * scale,
      };
      expect(
        normalizeRects(
          normalized.map((rect) => denormalizeRect(rect, resized)),
          resized,
        ),
      ).toEqual(normalized);
    }
    expect(JSON.parse(JSON.stringify(normalized))).toEqual(normalized);
  });
  it("clips outside-page rectangles and removes duplicates", () => {
    const rect = { left: -10, top: 10, width: 40, height: 5 };
    expect(
      normalizeRects(
        [rect, rect, { left: 105, top: 0, width: 10, height: 10 }],
        { left: 0, top: 0, width: 100, height: 100 },
      ),
    ).toEqual([{ x: 0, y: 0.1, width: 0.3, height: 0.05 }]);
  });
  it("supports intrinsically rotated landscape page dimensions", () => {
    const page = { left: 0, top: 0, width: 800, height: 600 };
    const rect = { left: 80, top: 60, width: 400, height: 12 };
    expect(denormalizeRect(normalizeRects([rect], page)[0], page)).toEqual(
      rect,
    );
  });
  it("rejects a zero-sized page", () => {
    expect(
      normalizeRects([{ left: 0, top: 0, width: 20, height: 10 }], {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
      }),
    ).toEqual([]);
  });
});
