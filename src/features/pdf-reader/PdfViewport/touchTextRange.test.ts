import { afterEach, describe, expect, it, vi } from 'vitest';
import { adjacentWord, boundaryWord, captureTouchRange, joinWordRanges, wordBounds } from './touchTextRange';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function lineRange(node: Text, start: number, end: number) {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return range;
}

describe('touch PDF word ranges', () => {
  it('finds whole words, punctuation, and Unicode boundaries in DOM offsets', () => {
    expect(wordBounds('Java collections, maps', 7)).toEqual({ start: 5, end: 16 });
    expect(wordBounds('Java collections, maps', 16)).toEqual({ start: 16, end: 17 });
    expect(wordBounds('Java collections, maps', 17)).toEqual({ start: 18, end: 22 });
    expect(wordBounds('caf\u00e9', 2)).toEqual({ start: 0, end: 4 });
    expect(wordBounds('a \u{1f600} word', 3)).toEqual({ start: 2, end: 4 });
    expect(wordBounds(' \n\t', 0)).toBeNull();
  });

  it('keeps a useful Unicode fallback on browsers without Intl.Segmenter', () => {
    vi.stubGlobal('Intl', { Segmenter: undefined });
    expect(wordBounds('caf\u00e9 next', 1)).toEqual({ start: 0, end: 4 });
    expect(wordBounds('a \u{1f600} word', 2)).toEqual({ start: 2, end: 4 });
    expect(wordBounds("don't stop", 3)).toEqual({ start: 0, end: 5 });
  });

  it('joins forward and backward gestures across PDF text nodes', () => {
    const layer = document.createElement('div');
    layer.innerHTML = '<span>First line</span><br><span>Second line</span>';
    const first = layer.children[0].firstChild as Text;
    const second = layer.children[2].firstChild as Text;
    const start = lineRange(first, 0, 5);
    const end = lineRange(second, 7, 11);
    for (const range of [joinWordRanges(start, end), joinWordRanges(end, start)]) {
      expect(range.startContainer).toBe(first);
      expect(range.startOffset).toBe(0);
      expect(range.endContainer).toBe(second);
      expect(range.endOffset).toBe(11);
      expect(boundaryWord(range, 'start')?.toString()).toBe('First');
      expect(boundaryWord(range, 'end')?.toString()).toBe('line');
    }
  });

  it('moves keyboard endpoints over whitespace and across PDF lines', () => {
    const layer = document.createElement('div');
    layer.innerHTML = '<span>First  line</span><br><span>Second line</span>';
    const first = layer.children[0].firstChild as Text;
    const second = layer.children[2].firstChild as Text;
    const firstWord = lineRange(first, 0, 5);
    const firstLineEnd = lineRange(first, 7, 11);
    const secondWord = lineRange(second, 0, 6);
    expect(adjacentWord(layer, firstWord, 'end', 1)?.toString()).toBe('line');
    expect(adjacentWord(layer, firstLineEnd, 'end', 1)?.toString()).toBe('Second');
    expect(adjacentWord(layer, secondWord, 'start', -1)?.toString()).toBe('line');
    expect(adjacentWord(layer, firstWord, 'start', -1)).toBeNull();
  });

  it('captures line breaks and normalized geometry without creating a native selection', () => {
    const page = document.createElement('div');
    page.innerHTML = '<div class="textLayer"><span>First line</span><br><span>Second line</span></div>';
    const layer = page.firstElementChild!;
    const first = layer.children[0].firstChild as Text;
    const second = layer.children[2].firstChild as Text;
    const range = joinWordRanges(lineRange(first, 6, 10), lineRange(second, 0, 6));
    Object.defineProperties(range, {
      getClientRects: { value: () => [new DOMRect(110, 70, 40, 10), new DOMRect(110, 85, 60, 10)] },
      getBoundingClientRect: { value: () => new DOMRect(110, 70, 60, 25) },
    });
    vi.spyOn(page, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 200, 300));
    const getNativeSelection = vi.spyOn(window, 'getSelection');
    const captured = captureTouchRange(range, page, 3, 7);
    expect(captured).toMatchObject({ source: 'touch', text: 'line\nSecond', anchor: {
      pageNumber: 3, documentContentVersion: 7, quote: { exact: 'line\nSecond' },
      rects: [
        { x: 0.05, y: 20 / 300, width: 0.2, height: 10 / 300 },
        { x: 0.05, y: 35 / 300, width: 0.3, height: 10 / 300 },
      ],
    } });
    expect(getNativeSelection).not.toHaveBeenCalled();
  });

  it('rejects outside-page and oversized selections before reading geometry', () => {
    const page = document.createElement('div');
    page.innerHTML = '<div class="textLayer"><span>Inside</span></div>';
    const outside = document.createTextNode('Outside');
    expect(captureTouchRange(lineRange(outside, 0, 7), page, 1, 1)).toBeNull();
    const text = page.querySelector('span')!.firstChild as Text;
    text.data = 'x'.repeat(10001);
    expect(captureTouchRange(lineRange(text, 0, text.length), page, 1, 1)).toBeNull();
  });
});
