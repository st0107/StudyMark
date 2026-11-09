import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadDialog } from './UploadDialog';

const mocks = vi.hoisted(() => ({ inspect: vi.fn(), upload: vi.fn() }));
vi.mock('./validateUpload', () => ({ inspectPdfUpload: mocks.inspect }));
vi.mock('../../shared/api', () => ({ api: { uploadDocument: mocks.upload } }));

beforeEach(() => {
  mocks.inspect.mockReset();
  mocks.upload.mockReset();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

function showUpload() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const onUploaded = vi.fn();
  const view = render(<QueryClientProvider client={client}><UploadDialog scope="PERSONAL" onClose={() => {}} onUploaded={onUploaded} /></QueryClientProvider>);
  return { ...view, client, onUploaded };
}

describe('PDF upload lifecycle', () => {
  it('does not upload into a new session when the dialog leaves during PDF inspection', async () => {
    let finishInspection!: (pages: number) => void;
    const inspection = new Promise<number>(resolve => { finishInspection = resolve; });
    mocks.inspect.mockReturnValue(inspection);
    const { unmount, client, onUploaded } = showUpload();
    const file = new File(['%PDF-1.7'], 'private-notes.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('Choose PDF file'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Upload PDF' }));
    expect(mocks.inspect).toHaveBeenCalledWith(file);

    unmount();
    await act(async () => { finishInspection(20); await inspection; });
    await waitFor(() => expect(client.isMutating()).toBe(0));
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
    client.clear();
  });

  it('retains the selected file and metadata after a failed save and retries them', async () => {
    mocks.inspect.mockResolvedValue(20);
    mocks.upload.mockRejectedValueOnce(new Error('Storage unavailable')).mockResolvedValueOnce({ id: 'new-pdf' });
    const { onUploaded, client } = showUpload();
    const file = new File(['%PDF-1.7'], 'private-notes.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('Choose PDF file'), file);
    await userEvent.clear(screen.getByLabelText('Document title'));
    await userEvent.type(screen.getByLabelText('Document title'), 'My revision notes');
    await userEvent.click(screen.getByRole('button', { name: 'Upload PDF' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Your selected file is still here');
    expect(screen.getByLabelText('Document title')).toHaveValue('My revision notes');
    expect(onUploaded).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Retry upload' }));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledOnce());
    expect(mocks.upload).toHaveBeenNthCalledWith(2, { file, title: 'My revision notes', subject: 'General', pageCount: 20, scope: 'PERSONAL' });
    client.clear();
  });
});
