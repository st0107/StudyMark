import { normalizeRects, type PdfSelection } from "../pdfAnchorAdapter";

export type SelectionEnd = "start" | "end";

function textNodes(layer: HTMLElement): Text[] {
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  const result: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.trim()) result.push(node as Text);
  }
  return result;
}

/** Word boundaries are UTF-16 offsets, matching the DOM Range API. */
export function wordBounds(
  text: string,
  offset: number,
): { start: number; end: number } | null {
  const segments =
    typeof Intl.Segmenter === "function"
      ? [
          ...new Intl.Segmenter(undefined, { granularity: "word" }).segment(
            text,
          ),
        ]
          .filter((item) => item.segment.trim())
          .map((item) => ({
            start: item.index,
            end: item.index + item.segment.length,
          }))
      : [
          ...text.matchAll(/[\p{L}\p{N}_]+(?:['’-][\p{L}\p{N}_]+)*|[^\s]/gu),
        ].map((item) => ({
          start: item.index,
          end: item.index + item[0].length,
        }));
  return (
    segments.find((item) => offset >= item.start && offset < item.end) ??
    segments.find((item) => item.start >= offset) ??
    segments.at(-1) ??
    null
  );
}

function wordRange(node: Text, offset: number): Range | null {
  const bounds = wordBounds(node.data, offset);
  if (!bounds) return null;
  const range = document.createRange();
  range.setStart(node, bounds.start);
  range.setEnd(node, bounds.end);
  return range;
}

function distanceToRect(x: number, y: number, rect: DOMRect): number {
  const dx = Math.max(rect.left - x, 0, x - rect.right);
  const dy = Math.max(rect.top - y, 0, y - rect.bottom);
  return dx * dx + dy * dy;
}

/** Hit-test measured PDF glyphs even when user-select:none disables native caret hit-testing. */
export function wordAtPoint(
  layer: HTMLElement,
  x: number,
  y: number,
  requireHit = false,
): Range | null {
  const range = document.createRange();
  let nearest: { node: Text; distance: number; rect: DOMRect } | null = null;
  for (const node of textNodes(layer)) {
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (!rect.width || !rect.height) continue;
      const distance = distanceToRect(x, y, rect);
      if (!nearest || distance < nearest.distance)
        nearest = { node, distance, rect };
    }
  }
  if (!nearest || (requireHit && nearest.distance > 12 * 12)) return null;
  let nearestOffset = 0;
  let nearestDistance = Infinity;
  // PDF text spans usually contain one short line. Code-point iteration avoids
  // creating a half-surrogate range for emoji and supplementary-plane scripts.
  for (let offset = 0; offset < nearest.node.length; ) {
    const length = String.fromCodePoint(
      nearest.node.data.codePointAt(offset)!,
    ).length;
    range.setStart(nearest.node, offset);
    range.setEnd(nearest.node, offset + length);
    const rect = range.getBoundingClientRect();
    const distance = distanceToRect(x, y, rect);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestOffset = offset;
    }
    offset += length;
  }
  return wordRange(nearest.node, nearestOffset);
}

export function joinWordRanges(first: Range, second: Range): Range {
  const range = document.createRange();
  const start =
    first.compareBoundaryPoints(Range.START_TO_START, second) <= 0
      ? first
      : second;
  const end =
    first.compareBoundaryPoints(Range.END_TO_END, second) >= 0 ? first : second;
  range.setStart(start.startContainer, start.startOffset);
  range.setEnd(end.endContainer, end.endOffset);
  return range;
}

export function boundaryWord(range: Range, end: SelectionEnd): Range | null {
  const node = end === "start" ? range.startContainer : range.endContainer;
  const offset =
    end === "start" ? range.startOffset : Math.max(0, range.endOffset - 1);
  return node.nodeType === Node.TEXT_NODE
    ? wordRange(node as Text, offset)
    : null;
}

export function adjacentWord(
  layer: HTMLElement,
  range: Range,
  end: SelectionEnd,
  direction: -1 | 1,
): Range | null {
  const current = boundaryWord(range, end);
  if (!current) return null;
  const node = current.startContainer as Text;
  const offset = direction < 0 ? current.startOffset - 1 : current.endOffset;
  const remaining =
    direction < 0 ? node.data.slice(0, offset + 1) : node.data.slice(offset);
  if (remaining.trim()) {
    const nextOffset =
      direction < 0
        ? remaining.trimEnd().length - 1
        : offset + remaining.length - remaining.trimStart().length;
    return wordRange(node, nextOffset);
  }
  const nodes = textNodes(layer);
  const next = nodes[nodes.indexOf(node) + direction];
  return next ? wordRange(next, direction < 0 ? next.length - 1 : 0) : null;
}

function rangeText(range: Range): string {
  const read = (node: Node): string =>
    node.nodeType === Node.TEXT_NODE
      ? (node.textContent ?? "")
      : node.nodeName === "BR"
        ? "\n"
        : Array.from(node.childNodes).map(read).join("");
  return read(range.cloneContents()).trim();
}

export function captureTouchRange(
  range: Range,
  page: HTMLElement,
  pageNumber: number,
  contentVersion: number,
): PdfSelection | null {
  const layer = page.querySelector(".textLayer");
  if (
    !layer?.contains(range.startContainer) ||
    !layer.contains(range.endContainer)
  )
    return null;
  const text = rangeText(range);
  if (!text || text.length > 10000) return null;
  const rects = normalizeRects(
    Array.from(range.getClientRects()),
    page.getBoundingClientRect(),
  );
  if (!rects.length) return null;
  const bounds = range.getBoundingClientRect();
  return {
    text,
    source: "touch",
    anchor: {
      schemaVersion: 1,
      documentContentVersion: contentVersion,
      pageNumber,
      rects,
      quote: { exact: text },
    },
    position: { x: bounds.left + bounds.width / 2, y: bounds.bottom + 10 },
  };
}
