import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pdfjs } from '../pdfEngine';
import { PdfViewport } from './index';

vi.mock('../pdfEngine', () => ({ pdfjs: {
  getDocument: vi.fn(),
  TextLayer: class { async render() {} cancel() {} },
} }));

afterEach(() => vi.unstubAllGlobals());

describe('PDF rendering cancellation', () => {
  it('handles a cancelled canvas immediately while its text request is pending', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    let rejectCanvas: (reason: Error) => void = () => {};
    let resolveText: (content: { items: { str: string }[] }) => void = () => {};
    const firstCanvas = new Promise<void>((_resolve, reject) => { rejectCanvas = reject; });
    const firstText = new Promise<{ items: { str: string }[] }>((resolve) => { resolveText = resolve; });
    const cancel = vi.fn(() => rejectCanvas(Object.assign(new Error('Cancelled'), { name: 'RenderingCancelledException' })));
    const getPage = vi.fn().mockImplementation(async (page: number) => ({
      getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
      render: () => ({ promise: page === 1 ? firstCanvas : Promise.resolve(), cancel: page === 1 ? cancel : vi.fn() }),
      getTextContent: () => page === 1 ? firstText : Promise.resolve({ items: [{ str: 'Second page' }] }),
    }));
    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.resolve({ numPages: 2, getPage }), destroy: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof pdfjs.getDocument>);
    const blob = new Blob();
    Object.defineProperty(blob, 'arrayBuffer', { value: async () => new ArrayBuffer(0) });
    const props = { blob, pageNumber: 1, zoom: 1, contentVersion: 1, annotations: [], onPageCount: vi.fn(), onSelection: vi.fn() };
    const { rerender } = render(<PdfViewport {...props} />);
    await waitFor(() => expect(getPage).toHaveBeenCalledWith(1));
    rerender(<PdfViewport {...props} pageNumber={2} />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(cancel).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('PDF page 2')).toBeInTheDocument();
    // Settle the abandoned text request after the second page has rendered.
    await act(async () => { resolveText({ items: [{ str: 'First page' }] }); });
    expect(screen.getByLabelText('PDF page 2')).toBeInTheDocument();
  });
});
