import { useRef, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureSelection, type PdfSelection } from '../pdfAnchorAdapter';
import { captureTouchRange, wordAtPoint } from './touchTextRange';
import { useTouchSelection } from './useTouchSelection';

vi.mock('../pdfAnchorAdapter', async (importOriginal) => ({
  ...await importOriginal<typeof import('../pdfAnchorAdapter')>(), captureSelection: vi.fn(),
}));
vi.mock('./touchTextRange', async (importOriginal) => ({
  ...await importOriginal<typeof import('./touchTextRange')>(), wordAtPoint: vi.fn(), captureTouchRange: vi.fn(),
}));

const selected: PdfSelection = { text: 'collections', source: 'touch', position: { x: 20, y: 30 },
  anchor: { schemaVersion: 1, documentContentVersion: 1, pageNumber: 1,
    rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.02 }], quote: { exact: 'collections' } } };

function Harness({ onSelection, pageNumber = 1, loading = false }: {
  onSelection: (selection: PdfSelection | null) => void; pageNumber?: number; loading?: boolean;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<PdfSelection | null>(null);
  const touch = useTouchSelection({ pageRef, pageNumber, contentVersion: 1, loading, layoutKey: '1:600', selection,
    onSelection: (next) => { setSelection(next); onSelection(next); } });
  return <><div ref={pageRef} data-testid="page" tabIndex={0}><div className="textLayer">collections</div></div>
    <output>{touch?.text}</output><button onClick={() => setSelection(null)}>Clear</button>
    <div className="selection-toolbar"><button>Toolbar action</button></div></>;
}

function touchEvent(type: string, points: { x: number; y: number; id?: number }[] = [{ x: 30, y: 40 }]) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: points.map(({ x, y, id = 0 }) => ({ identifier: id, clientX: x, clientY: y })) });
  fireEvent(screen.getByTestId('page'), event);
  return event;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(captureSelection).mockReturnValue(null);
  vi.mocked(wordAtPoint).mockImplementation(layer => {
    const range = document.createRange();
    range.selectNodeContents(layer.firstChild!);
    return range;
  });
  vi.mocked(captureTouchRange).mockReturnValue(selected);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('touch selection lifecycle', () => {
  it('leaves taps, ordinary swipes, and multitouch available to the browser', () => {
    const onSelection = vi.fn();
    render(<Harness onSelection={onSelection} />);
    expect(touchEvent('touchstart').defaultPrevented).toBe(false);
    act(() => { vi.advanceTimersByTime(100); });
    expect(touchEvent('touchend', []).defaultPrevented).toBe(false);
    touchEvent('touchstart');
    expect(touchEvent('touchmove', [{ x: 30, y: 90 }]).defaultPrevented).toBe(false);
    act(() => { vi.advanceTimersByTime(500); });
    touchEvent('touchend', []);
    touchEvent('touchstart');
    touchEvent('touchstart', [{ x: 30, y: 40 }, { x: 90, y: 40, id: 1 }]);
    act(() => { vi.advanceTimersByTime(500); });
    expect(onSelection).not.toHaveBeenCalled();
  });

  it('keeps a held selection through native selectionchange, and clears it after an action', () => {
    const onSelection = vi.fn();
    render(<Harness onSelection={onSelection} />);
    touchEvent('touchstart');
    act(() => { vi.advanceTimersByTime(451); });
    expect(onSelection).toHaveBeenLastCalledWith(selected);
    expect(screen.getByRole('status')).toHaveTextContent('collections');
    expect(touchEvent('touchmove', [{ x: 40, y: 40 }]).defaultPrevented).toBe(true);
    touchEvent('touchend', []);
    onSelection.mockClear();
    fireEvent(document, new Event('selectionchange'));
    expect(onSelection).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('collections');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('cancels a pending hold when the PDF starts rerendering', () => {
    const onSelection = vi.fn();
    const { rerender } = render(<Harness onSelection={onSelection} />);
    touchEvent('touchstart');
    rerender(<Harness onSelection={onSelection} loading />);
    act(() => { vi.advanceTimersByTime(500); });
    expect(onSelection).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('can switch from a native selection to touch without cancelling the hold', () => {
    const onSelection = vi.fn();
    render(<Harness onSelection={onSelection} />);
    vi.mocked(captureSelection).mockReturnValue({ ...selected, source: undefined });
    fireEvent(document, new Event('selectionchange'));
    onSelection.mockClear();
    touchEvent('touchstart');
    vi.mocked(captureSelection).mockReturnValue(null);
    // The browser queues this after touch mode removes the old native range.
    fireEvent(document, new Event('selectionchange'));
    act(() => { vi.advanceTimersByTime(451); });
    expect(onSelection).toHaveBeenLastCalledWith(selected);
    expect(screen.getByRole('status')).toHaveTextContent('collections');
  });

  it('clears custom geometry when the page changes', () => {
    const onSelection = vi.fn();
    const { rerender } = render(<Harness onSelection={onSelection} />);
    touchEvent('touchstart');
    act(() => { vi.advanceTimersByTime(451); });
    touchEvent('touchend', []);
    rerender(<Harness onSelection={onSelection} pageNumber={2} />);
    expect(onSelection).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('captures native selectionchange and keeps the toolbar usable by keyboard', () => {
    const onSelection = vi.fn();
    render(<Harness onSelection={onSelection} />);
    const native = { ...selected, source: undefined };
    vi.mocked(captureSelection).mockReturnValue(native);
    fireEvent(document, new Event('selectionchange'));
    expect(onSelection).toHaveBeenLastCalledWith(native);
    onSelection.mockClear();
    vi.mocked(captureSelection).mockReturnValue(null);
    screen.getByRole('button', { name: 'Toolbar action' }).focus();
    fireEvent(document, new Event('selectionchange'));
    expect(onSelection).not.toHaveBeenCalled();
    screen.getByTestId('page').focus();
    fireEvent(document, new Event('selectionchange'));
    expect(onSelection).toHaveBeenLastCalledWith(null);
  });
});
