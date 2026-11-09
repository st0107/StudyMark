import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../../shared/api';
import type { StudyDocument } from '../../shared/types';
import PdfReaderPage from './PdfReaderPage';

vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'reader' } }) }));
vi.mock('./PdfViewport', () => ({ PdfViewport: ({ pageNumber }: { pageNumber: number }) => <div>Rendered page {pageNumber}</div> }));
vi.mock('../../shared/api', async () => ({
  ...await import('../../shared/api/errors'), isMockApi: true,
  api: { getDocument: vi.fn(), getDocumentContent: vi.fn(), listAnnotations: vi.fn(), saveProgress: vi.fn() },
}));

describe('reading progress', () => {
  it('resumes the latest committed page when reopening a cached document', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    const document: StudyDocument = {
      id: 'material', title: 'Study material', description: '', subject: 'Computing', scope: 'SHARED', status: 'PUBLISHED',
      uploadedBy: 'admin', pageCount: 20, sizeBytes: 100, contentVersion: 1,
      createdAt: '2026-01-01', updatedAt: '2026-01-01', lastPage: 3, annotationCount: 0,
    };
    client.setQueryData(['document', 'reader', 'material'], document);
    client.setQueryData(['document-content', 'reader', 'material'], new Blob());
    client.setQueryData(['annotations', 'reader', 'material'], []);
    let finishSave: () => void = () => {};
    vi.mocked(api.saveProgress).mockImplementation(() => new Promise<void>((resolve) => { finishSave = resolve; }));
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/reader/material']}><Routes>
      <Route path="/reader/:documentId" element={<PdfReaderPage />} />
      <Route path="/library" element={<Link to="/reader/material">Open material</Link>} />
    </Routes></MemoryRouter></QueryClientProvider>);

    expect(screen.getByText('Rendered page 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(api.saveProgress).toHaveBeenCalledWith('material', 4));
    // Navigation may finish before an asynchronous progress write commits.
    fireEvent.click(screen.getByRole('link', { name: 'Back to library' }));
    finishSave();
    await waitFor(() => expect(client.getQueryData<StudyDocument>(['document', 'reader', 'material'])?.lastPage).toBe(4));
    fireEvent.click(screen.getByRole('link', { name: 'Open material' }));
    expect(screen.getByText('Rendered page 4')).toBeInTheDocument();
    expect(api.getDocument).not.toHaveBeenCalled();
    client.clear();
  });
});
