import type { NormalizedRect, PdfAnchor } from '../../shared/types';

export interface PageBounds { left: number; top: number; width: number; height: number }
export interface ClientRect { left: number; top: number; width: number; height: number }
export interface PdfSelection { text: string; anchor: PdfAnchor; position: { x: number; y: number } }

/** Coordinates refer to the page's intrinsic, rotated viewport, independent of CSS zoom. */
export function normalizeRects(rects: ClientRect[], page: PageBounds): NormalizedRect[] {
  if (page.width <= 0 || page.height <= 0) return [];
  const result: NormalizedRect[] = [];
  for (const rect of rects) {
    const left = Math.max(rect.left, page.left);
    const top = Math.max(rect.top, page.top);
    const right = Math.min(rect.left + rect.width, page.left + page.width);
    const bottom = Math.min(rect.top + rect.height, page.top + page.height);
    if (right - left < 0.5 || bottom - top < 0.5) continue;
    const normalized = { x: (left - page.left) / page.width, y: (top - page.top) / page.height,
      width: (right - left) / page.width, height: (bottom - top) / page.height };
    // Browser ranges can report both wrapper and text rectangles. Keep unique rectangles.
    if (!result.some((existing) => Object.keys(normalized).every((key) =>
      Math.abs(existing[key as keyof NormalizedRect] - normalized[key as keyof NormalizedRect]) < 0.0001))) {
      result.push(normalized);
    }
  }
  return result;
}

export function denormalizeRect(rect: NormalizedRect, page: PageBounds): ClientRect {
  return { left: page.left + rect.x * page.width, top: page.top + rect.y * page.height,
    width: rect.width * page.width, height: rect.height * page.height };
}

export function captureSelection(pageElement: HTMLElement, pageNumber: number, contentVersion: number): PdfSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const textLayer = pageElement.querySelector('.textLayer');
  if (!textLayer?.contains(range.startContainer) || !textLayer.contains(range.endContainer)) return null;
  const text = selection.toString().trim();
  if (!text || text.length > 10000) return null;
  const rects = normalizeRects(Array.from(range.getClientRects()), pageElement.getBoundingClientRect());
  if (!rects.length) return null;
  const bounds = range.getBoundingClientRect();
  return { text, anchor: { schemaVersion: 1, documentContentVersion: contentVersion, pageNumber, rects, quote: { exact: text } },
    position: { x: bounds.left + bounds.width / 2, y: bounds.bottom + 10 } };
}
