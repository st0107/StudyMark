import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudyDocument } from '../../shared/types';
import { LibraryPage } from './LibraryPage';

const listDocuments = vi.hoisted(() => vi.fn());
vi.mock('../../shared/api', () => ({ api: { listDocuments } }));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'student-a', role: 'USER' } }) }));

const base: StudyDocument = {
  id: 'java', title: 'Java Collections', description: 'Review hash maps and sets.', subject: 'Programming',
  scope: 'SHARED', status: 'PUBLISHED', uploadedBy: 'admin', pageCount: 20, sizeBytes: 1000,
  contentVersion: 1, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', lastPage: 0, annotationCount: 0,
};
const documents = [base, { ...base, id: 'algorithms', title: 'Algorithm Practice', description: 'Review trees and traversal.', subject: 'Algorithms' }];

beforeEach(() => listDocuments.mockReset());

function showLibrary() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><LibraryPage scope="SHARED" /></MemoryRouter></QueryClientProvider>);
}

describe('library browsing', () => {
  it('combines subject and keyword filters, and clears an empty result', async () => {
    listDocuments.mockResolvedValue(documents);
    showLibrary();
    await screen.findByRole('link', { name: 'Java Collections' });
    await userEvent.type(screen.getByRole('textbox', { name: 'Search documents' }), 'review');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by subject' }), 'Algorithms');
    expect(screen.getByRole('link', { name: 'Algorithm Practice' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Java Collections' })).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: 'Search documents' }), ' hash');
    expect(screen.getByRole('heading', { name: 'No matching materials' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('textbox', { name: 'Search documents' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Filter by subject' })).toHaveValue('all');
    expect(screen.getByRole('link', { name: 'Java Collections' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Algorithm Practice' })).toBeVisible();
  });

  it('lets a failed catalog load retry without leaving the library', async () => {
    listDocuments.mockRejectedValueOnce(new Error('Connection unavailable')).mockResolvedValueOnce(documents);
    showLibrary();
    expect(await screen.findByText('Connection unavailable')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Java Collections' })).toBeVisible());
    expect(listDocuments).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('link', { name: 'Shared materials' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'My PDFs' })).toHaveAttribute('href', '/my-pdfs');
  });
});
