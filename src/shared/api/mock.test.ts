// @vitest-environment node
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { File as NodeFile } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateAnnotationInput } from '../types';
import { failNextMockMutation, mockApi as api, resetMockInitializationForTests } from './mock';
import { readFile, resetStorageForTests } from './storage';
import { validatePdfFile } from './validation';

const session = new Map<string, string>();
vi.stubGlobal('crypto', webcrypto);
vi.stubGlobal('localStorage', {
  getItem: (key: string) => session.get(key) ?? null,
  setItem: (key: string, value: string) => session.set(key, value),
  removeItem: (key: string) => session.delete(key),
});

const login = (name = 'alex') => api.login({ email: `${name}@studymark.app`, password: 'StudyMark123!' });
const file = (content = '%PDF-1.7 sample', name = 'study.pdf') => new NodeFile([content], name, { type: 'application/pdf' }) as unknown as File;
const highlight: CreateAnnotationInput = {
  type: 'HIGHLIGHT', pageNumber: 2, selectedText: 'A multiline selection.', color: '#FFE066', noteText: 'Remember this.',
  anchor: { schemaVersion: 1, documentContentVersion: 1, pageNumber: 2, rects: [{ x: 0.1, y: 0.2, width: 0.7, height: 0.03 }, { x: 0.1, y: 0.24, width: 0.2, height: 0.03 }] },
};

beforeEach(async () => {
  await resetStorageForTests();
  resetMockInitializationForTests();
  session.clear();
});

afterEach(() => vi.restoreAllMocks());

describe('mock authentication and private account isolation', () => {
  it('requires authentication and rejects incorrect credentials', async () => {
    expect(await api.getSession()).toBeNull();
    await expect(api.listDocuments({ scope: 'SHARED' })).rejects.toMatchObject({ status: 401 });
    await expect(api.login({ email: 'alex@studymark.app', password: 'wrong' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('persists registration, normalizes emails, validates forms, and never creates an admin', async () => {
    await expect(api.register({ displayName: '', email: 'bad', password: 'a' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const user = await api.register({ displayName: ' New Student ', email: 'NEW@EXAMPLE.COM ', password: 'Password123' });
    expect(user).toMatchObject({ displayName: 'New Student', email: 'new@example.com', role: 'USER' });
    expect(user).not.toHaveProperty('passwordDigest');
    await api.logout();
    expect(await api.getSession()).toBeNull();
    expect((await api.login({ email: 'new@example.com', password: 'Password123' })).id).toBe(user.id);
    await expect(api.register({ displayName: 'Another', email: 'new@example.com', password: 'Password123' })).rejects.toMatchObject({ code: 'EMAIL_IN_USE' });
  });

  it('hides personal documents and annotations from another student and admin', async () => {
    await login();
    const annotation = await api.createAnnotation('alex-java-notes', highlight);
    for (const account of ['sam', 'admin']) {
      await login(account);
      expect(await api.listDocuments({ scope: 'PERSONAL' })).toHaveLength(0);
      await expect(api.getDocument('alex-java-notes')).rejects.toMatchObject({ status: 404 });
      await expect(api.getDocumentContent('alex-java-notes')).rejects.toMatchObject({ status: 404 });
      await expect(api.renameDocument('alex-java-notes', 'Stolen')).rejects.toMatchObject({ status: 404 });
      await expect(api.deleteDocument('alex-java-notes')).rejects.toMatchObject({ status: 404 });
      await expect(api.updateAnnotation(annotation.id, { rowVersion: 1, noteText: 'Stolen' })).rejects.toMatchObject({ status: 404 });
      expect(await api.getAllAnnotations()).toHaveLength(0);
    }
  });

  it('isolates shared-document notes and restores them after a new API initialization', async () => {
    await login();
    const created = await api.createAnnotation('java-collections', highlight);
    await login('sam');
    expect(await api.listAnnotations('java-collections')).toHaveLength(0);
    await api.logout();
    resetMockInitializationForTests();
    await login();
    const restored = (await api.listAnnotations('java-collections')).find(item => item.id === created.id);
    expect(restored?.anchor?.rects).toEqual(highlight.anchor?.rects);
    expect(restored?.noteText).toBe('Remember this.');
  });

  it('cancels in-flight writes when the active account changes', async () => {
    await login();
    const saving = api.createAnnotation('java-collections', highlight);
    await api.logout();
    await expect(saving).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await login('sam');
    expect(await api.listAnnotations('java-collections')).toHaveLength(0);
    await login();
    expect((await api.listAnnotations('java-collections')).some(item => item.selectedText === highlight.selectedText)).toBe(false);
  });

  it('does not revive a pending upload after switching away and back to the same account', async () => {
    await login();
    let finishSignature!: (value: ArrayBuffer) => void;
    const signature = new Promise<ArrayBuffer>(resolve => { finishSignature = resolve; });
    const input = file();
    vi.spyOn(input, 'slice').mockReturnValue({ arrayBuffer: () => signature } as Blob);
    const uploading = api.uploadDocument({ file: input, title: 'Canceled upload', subject: 'Test', pageCount: 2 });
    const rejected = expect(uploading).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await login('sam');
    await login();
    finishSignature(new TextEncoder().encode('%PDF-').buffer);
    await rejected;
    expect((await api.listDocuments({ scope: 'PERSONAL' })).some(item => item.title === 'Canceled upload')).toBe(false);
  });

  it('discards PDF bytes when the account changes while the response body downloads', async () => {
    await login();
    let finishBody!: (value: Blob) => void;
    const body = new Promise<Blob>(resolve => { finishBody = resolve; });
    const readBody = vi.fn(() => body);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, blob: readBody } as unknown as Response);
    const downloading = api.getDocumentContent('alex-java-notes');
    const rejected = expect(downloading).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await vi.waitFor(() => expect(readBody).toHaveBeenCalledOnce());
    await login('sam');
    await login();
    finishBody(new Blob(['%PDF-1.7 private content']));
    await rejected;
  });

  it('does not finish a pending sign-in after logout', async () => {
    const signingIn = login();
    const rejected = expect(signingIn).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await api.logout();
    await rejected;
    expect(await api.getSession()).toBeNull();
  });
});

describe('annotations, progress and errors', () => {
  it('supports create, edit, color changes and idempotent delete', async () => {
    await login();
    const note = await api.createAnnotation('java-collections', { type: 'PAGE_NOTE', pageNumber: 3, noteText: 'First note' });
    const changedNote = await api.updateAnnotation(note.id, { rowVersion: 1, noteText: 'Updated note' });
    expect(changedNote).toMatchObject({ noteText: 'Updated note', rowVersion: 2 });
    const created = await api.createAnnotation('java-collections', highlight);
    const changed = await api.updateAnnotation(created.id, { rowVersion: 1, color: '#A7E8BD', noteText: '' });
    expect(changed).toMatchObject({ color: '#A7E8BD', noteText: '', rowVersion: 2 });
    await api.deleteAnnotation(created.id);
    await api.deleteAnnotation(created.id);
    expect((await api.listAnnotations('java-collections')).some(item => item.id === created.id)).toBe(false);
  });

  it('rejects stale concurrent updates without overwriting the saved note', async () => {
    await login();
    const note = await api.createAnnotation('java-collections', { type: 'PAGE_NOTE', pageNumber: 1, noteText: 'Original' });
    const updates = await Promise.allSettled([
      api.updateAnnotation(note.id, { rowVersion: 1, noteText: 'First tab' }),
      api.updateAnnotation(note.id, { rowVersion: 1, noteText: 'Second tab' }),
    ]);
    expect(updates.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    const rejected = updates.find(item => item.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason.code).toBe('VERSION_CONFLICT');
  });

  it('does not commit failed saves and allows retrying the same input', async () => {
    await login();
    const before = await api.listAnnotations('java-collections');
    failNextMockMutation();
    await expect(api.createAnnotation('java-collections', highlight)).rejects.toMatchObject({ code: 'SIMULATED_ERROR' });
    expect(await api.listAnnotations('java-collections')).toHaveLength(before.length);
    await api.createAnnotation('java-collections', highlight);
    expect(await api.listAnnotations('java-collections')).toHaveLength(before.length + 1);
  });

  it('rejects out-of-range pages, invalid anchors, wrong content versions and empty notes', async () => {
    await login();
    await expect(api.createAnnotation('java-collections', { type: 'PAGE_NOTE', pageNumber: 21, noteText: 'Invalid' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(api.createAnnotation('java-collections', { type: 'PAGE_NOTE', pageNumber: 1, noteText: '  ' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(api.createAnnotation('java-collections', { ...highlight, anchor: { ...highlight.anchor!, documentContentVersion: 2 } })).rejects.toMatchObject({ code: 'INVALID_ANCHOR' });
    await expect(api.createAnnotation('java-collections', { ...highlight, anchor: { ...highlight.anchor!, rects: [{ x: 0.9, y: 0, width: 0.5, height: 0.1 }] } })).rejects.toMatchObject({ code: 'INVALID_ANCHOR' });
  });

  it('keeps reading progress per user and document', async () => {
    await login();
    await api.saveProgress('java-collections', 8);
    expect((await api.getDocument('java-collections')).lastPage).toBe(8);
    await login('sam');
    expect((await api.getDocument('java-collections')).lastPage).toBe(0);
    await expect(api.saveProgress('java-collections', 201)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('uploads and publication', () => {
  it('rejects disguised PDFs, wrong extensions, empty files, oversize files and excess pages', async () => {
    await login();
    await expect(validatePdfFile(file('hello'))).rejects.toMatchObject({ code: 'UNSUPPORTED_PDF' });
    await expect(validatePdfFile(file('%PDF-1.7', 'script.exe'))).rejects.toMatchObject({ code: 'UNSUPPORTED_PDF' });
    await expect(validatePdfFile(file(''))).rejects.toMatchObject({ code: 'UNSUPPORTED_PDF' });
    const oversized = file();
    Object.defineProperty(oversized, 'size', { value: 26 * 1024 * 1024 });
    await expect(validatePdfFile(oversized)).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
    await expect(api.uploadDocument({ file: file(), title: 'Too long', subject: 'Test', pageCount: 201 })).rejects.toMatchObject({ code: 'UNSUPPORTED_PDF' });
  });

  it('stores PDF blobs, renames owned uploads, and deletes associated annotations and bytes', async () => {
    await login();
    const document = await api.uploadDocument({ file: file(), title: 'My handout', subject: 'Java', pageCount: 2 });
    expect(document).toMatchObject({ scope: 'PERSONAL', status: 'ACTIVE', uploadedBy: 'user-alex' });
    expect(await (await api.getDocumentContent(document.id)).text()).toBe('%PDF-1.7 sample');
    await api.createAnnotation(document.id, highlight);
    expect((await api.renameDocument(document.id, 'Renamed handout')).title).toBe('Renamed handout');
    await api.deleteDocument(document.id);
    await api.deleteDocument(document.id);
    expect(await readFile(document.id)).toBeUndefined();
    expect((await api.getAllAnnotations()).some(item => item.documentId === document.id)).toBe(false);
  });

  it('restricts publication controls and preserves annotations across unpublish/republish', async () => {
    await login();
    const note = await api.createAnnotation('java-collections', highlight);
    await expect(api.setPublication('java-collections', 'DRAFT')).rejects.toMatchObject({ status: 403 });
    await expect(api.listAdminDocuments()).rejects.toMatchObject({ status: 403 });
    await expect(api.uploadDocument({ file: file(), title: 'Shared', subject: 'Java', pageCount: 2, scope: 'SHARED' })).rejects.toMatchObject({ status: 403 });
    await login('admin');
    await api.setPublication('java-collections', 'DRAFT');
    await login();
    expect((await api.listDocuments({ scope: 'SHARED' })).some(item => item.id === 'java-collections')).toBe(false);
    await expect(api.getDocumentContent('java-collections')).rejects.toMatchObject({ status: 404 });
    await expect(api.listAnnotations('java-collections')).rejects.toMatchObject({ status: 404 });
    expect((await api.getAllAnnotations()).some(item => item.id === note.id)).toBe(false);
    await login('admin');
    await api.setPublication('java-collections', 'PUBLISHED');
    await login();
    expect((await api.listAnnotations('java-collections')).some(item => item.id === note.id)).toBe(true);
  });

  it('creates admin shared uploads as drafts, separate from personal uploads', async () => {
    await login('admin');
    const document = await api.uploadDocument({ file: file(), title: 'Shared draft', subject: 'Java', pageCount: 2, scope: 'SHARED' });
    expect(document.status).toBe('DRAFT');
    expect((await api.listAdminDocuments()).some(item => item.id === document.id)).toBe(true);
    expect((await api.listDocuments({ scope: 'PERSONAL' })).some(item => item.id === document.id)).toBe(false);
    await api.setPublication(document.id, 'PUBLISHED');
    await login('sam');
    expect((await api.getDocument(document.id)).title).toBe('Shared draft');
  });
});
