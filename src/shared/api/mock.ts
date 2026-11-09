import type { Annotation, StudyDocument, StudyMarkApi, User } from '../types';
import { ApiError } from './errors';
import { createSeed, passwordDigest } from './seed';
import { readFile, readState, writeState } from './storage';
import type { DatabaseState, StoredDocument, StoredUser } from './storage';
import { MAX_PDF_PAGES, validateAnnotation, validateEmail, validatePage, validatePassword, validatePdfFile, validateTitle } from './validation';

const SESSION_KEY = 'studymark.session';
const SESSION_REVISION_KEY = 'studymark.session.revision';
let initialization: Promise<void> | undefined;
let failNextMutation = false;

export function failNextMockMutation(): void { failNextMutation = true; }

function checkSimulatedFailure(): void {
  if (failNextMutation) {
    failNextMutation = false;
    throw new ApiError('The save could not be completed. Your changes are still here; please retry.', 'SIMULATED_ERROR', 503);
  }
}

export async function initializeMockApi(): Promise<void> {
  if (!initialization) {
    initialization = createSeed().then(seed => writeState(existing => ({ state: existing ?? seed, result: undefined })));
    initialization.catch(() => { initialization = undefined; });
  }
  return initialization;
}

export function resetMockInitializationForTests(): void {
  initialization = undefined;
  failNextMutation = false;
}

async function state(): Promise<DatabaseState> {
  await initializeMockApi();
  return readState();
}

function sessionSnapshot() {
  return { userId: localStorage.getItem(SESSION_KEY), revision: localStorage.getItem(SESSION_REVISION_KEY) };
}

function beginSessionChange() {
  // A new revision also cancels work if the user signs back into the same account.
  localStorage.setItem(SESSION_REVISION_KEY, crypto.randomUUID());
  return sessionSnapshot();
}

function requireUnchangedSession(expected: ReturnType<typeof sessionSnapshot>, authenticated = true): void {
  const current = sessionSnapshot();
  if ((authenticated && !expected.userId) || current.userId !== expected.userId || current.revision !== expected.revision) {
    throw new ApiError('Your session changed. Please sign in and try again.', 'UNAUTHENTICATED', 401);
  }
}

async function authenticatedState(): Promise<DatabaseState> {
  const expected = sessionSnapshot();
  const data = await state();
  requireUnchangedSession(expected);
  return data;
}

function publicUser(user: StoredUser): User {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}

function currentUser(data: DatabaseState): StoredUser {
  const id = localStorage.getItem(SESSION_KEY);
  const user = data.users.find(item => item.id === id);
  if (!user) throw new ApiError('Please sign in to continue.', 'UNAUTHENTICATED', 401);
  return user;
}

function adminUser(data: DatabaseState): StoredUser {
  const user = currentUser(data);
  if (user.role !== 'ADMIN') throw new ApiError('Administrator access is required.', 'FORBIDDEN', 403);
  return user;
}

function canAccess(document: StoredDocument, user: User): boolean {
  return document.scope === 'PERSONAL'
    ? document.uploadedBy === user.id
    : document.status === 'PUBLISHED' || user.role === 'ADMIN';
}

function accessibleDocument(data: DatabaseState, id: string, user: User): StoredDocument {
  const document = data.documents.find(item => item.id === id && canAccess(item, user));
  if (!document) throw new ApiError('This document is unavailable or you no longer have access.', 'DOCUMENT_NOT_FOUND', 404);
  return document;
}

function ownedPersonalDocument(data: DatabaseState, id: string, user: User): StoredDocument {
  const document = accessibleDocument(data, id, user);
  if (document.scope !== 'PERSONAL' || document.uploadedBy !== user.id) {
    throw new ApiError('Only your own personal PDFs can be changed here.', 'FORBIDDEN', 403);
  }
  return document;
}

function decorateDocument(data: DatabaseState, document: StoredDocument, user: User): StudyDocument {
  return {
    id: document.id, title: document.title, description: document.description, subject: document.subject,
    scope: document.scope, status: document.status, uploadedBy: document.uploadedBy,
    pageCount: document.pageCount, sizeBytes: document.sizeBytes, contentVersion: document.contentVersion,
    createdAt: document.createdAt, updatedAt: document.updatedAt,
    lastPage: data.progress[`${user.id}:${document.id}`] ?? 0,
    annotationCount: data.annotations.filter(item => item.userId === user.id && item.documentId === document.id).length,
  };
}

function ownedAnnotation(data: DatabaseState, id: string, user: User): Annotation {
  const annotation = data.annotations.find(item => item.id === id && item.userId === user.id);
  if (!annotation) throw new ApiError('This annotation is unavailable.', 'ANNOTATION_NOT_FOUND', 404);
  accessibleDocument(data, annotation.documentId, user);
  return annotation;
}

async function mutate<T>(change: (data: DatabaseState, user: StoredUser, files: IDBObjectStore) => T, expected = sessionSnapshot()): Promise<T> {
  await initializeMockApi();
  const result = await writeState((data, files) => {
    requireUnchangedSession(expected);
    if (!data) throw new ApiError('Demo storage is unavailable.', 'STORAGE_ERROR');
    const result = change(data, currentUser(data), files);
    return { state: data, result };
  });
  requireUnchangedSession(expected);
  return result;
}

export const mockApi: StudyMarkApi = {
  async getSession() {
    const expected = sessionSnapshot();
    const data = await state();
    requireUnchangedSession(expected, false);
    const user = data.users.find(item => item.id === expected.userId);
    return user ? publicUser(user) : null;
  },
  async login({ email, password }) {
    const expected = beginSessionChange();
    const data = await state();
    const user = data.users.find(item => item.email === email.trim().toLowerCase());
    if (!user || user.passwordDigest !== await passwordDigest(password, user.id)) {
      throw new ApiError('The email or password is incorrect.', 'INVALID_CREDENTIALS', 401);
    }
    requireUnchangedSession(expected, false);
    localStorage.setItem(SESSION_KEY, user.id);
    return publicUser(user);
  },
  async register({ displayName, email, password }) {
    if (!validateEmail(email)) throw new ApiError('Enter a valid email address.', 'VALIDATION_ERROR', 400);
    if (!validatePassword(password)) throw new ApiError('Use a password between 8 and 128 characters.', 'VALIDATION_ERROR', 400);
    const name = displayName.trim();
    if (!name || name.length > 80) throw new ApiError('Enter a name between 1 and 80 characters.', 'VALIDATION_ERROR', 400);
    const expected = beginSessionChange();
    await initializeMockApi();
    const id = crypto.randomUUID();
    const newUser: StoredUser = { id, displayName: name, email: email.trim().toLowerCase(), role: 'USER', passwordDigest: await passwordDigest(password, id) };
    const user = await writeState(data => {
      requireUnchangedSession(expected, false);
      if (!data) throw new ApiError('Demo storage is unavailable.', 'STORAGE_ERROR');
      if (data.users.some(item => item.email === newUser.email)) throw new ApiError('An account with this email already exists.', 'EMAIL_IN_USE', 409);
      data.users.push(newUser);
      return { state: data, result: publicUser(newUser) };
    });
    requireUnchangedSession(expected, false);
    localStorage.setItem(SESSION_KEY, user.id);
    return user;
  },
  async logout() { beginSessionChange(); localStorage.removeItem(SESSION_KEY); },
  async updateProfile({ displayName }) {
    return mutate((data, user) => {
      checkSimulatedFailure();
      const name = displayName.trim();
      if (!name || name.length > 80) throw new ApiError('Enter a name between 1 and 80 characters.', 'VALIDATION_ERROR', 400);
      user.displayName = name;
      return publicUser(data.users.find(item => item.id === user.id)!);
    });
  },
  async listDocuments({ scope, search = '', subject }) {
    const data = await authenticatedState();
    const user = currentUser(data);
    return data.documents
      .filter(document => document.scope === scope && canAccess(document, user) && (scope !== 'SHARED' || document.status === 'PUBLISHED'))
      .filter(document => !subject || subject === 'All subjects' || document.subject === subject)
      .filter(document => `${document.title} ${document.description} ${document.subject}`.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(document => decorateDocument(data, document, user));
  },
  async getDocument(id) {
    const data = await authenticatedState();
    const user = currentUser(data);
    return decorateDocument(data, accessibleDocument(data, id, user), user);
  },
  async getDocumentContent(id) {
    const expected = sessionSnapshot();
    const data = await authenticatedState();
    const document = accessibleDocument(data, id, currentUser(data));
    const file = await readFile(id);
    requireUnchangedSession(expected);
    if (file) return file;
    if (!document.sourceUrl) throw new ApiError('The PDF file could not be found.', 'DOCUMENT_NOT_FOUND', 404);
    const response = await fetch(document.sourceUrl);
    requireUnchangedSession(expected);
    if (!response.ok) throw new ApiError('The PDF could not be loaded. Please retry.', 'CONTENT_UNAVAILABLE', response.status);
    const content = await response.blob();
    requireUnchangedSession(expected);
    return content;
  },
  async uploadDocument(input) {
    const expected = sessionSnapshot();
    await validatePdfFile(input.file);
    const title = validateTitle(input.title);
    if (!Number.isInteger(input.pageCount) || input.pageCount < 1 || input.pageCount > MAX_PDF_PAGES) {
      throw new ApiError('PDFs must contain between 1 and 200 pages.', 'UNSUPPORTED_PDF', 400);
    }
    return mutate((data, user, files) => {
      checkSimulatedFailure();
      const scope = input.scope ?? 'PERSONAL';
      if (scope === 'SHARED') adminUser(data);
      const now = new Date().toISOString();
      const document: StoredDocument = {
        id: crypto.randomUUID(), title, description: scope === 'SHARED' ? 'Shared study material.' : 'Your private study material.',
        subject: input.subject.trim().slice(0, 80) || 'General', scope,
        status: scope === 'SHARED' ? 'DRAFT' : 'ACTIVE', uploadedBy: user.id,
        pageCount: input.pageCount, sizeBytes: input.file.size, contentVersion: 1,
        createdAt: now, updatedAt: now, lastPage: 0, annotationCount: 0,
      };
      data.documents.push(document);
      files.put(input.file, document.id);
      return decorateDocument(data, document, user);
    }, expected);
  },
  async renameDocument(id, title) {
    return mutate((data, user) => {
      checkSimulatedFailure();
      const document = ownedPersonalDocument(data, id, user);
      document.title = validateTitle(title);
      document.updatedAt = new Date().toISOString();
      return decorateDocument(data, document, user);
    });
  },
  async deleteDocument(id) {
    return mutate((data, user, files) => {
      checkSimulatedFailure();
      if (!data.documents.some(item => item.id === id)) return;
      ownedPersonalDocument(data, id, user);
      data.documents = data.documents.filter(item => item.id !== id);
      data.annotations = data.annotations.filter(item => item.documentId !== id);
      for (const key of Object.keys(data.progress)) if (key.endsWith(`:${id}`)) delete data.progress[key];
      files.delete(id);
    });
  },
  async listAdminDocuments() {
    const data = await authenticatedState();
    const user = adminUser(data);
    return data.documents.filter(item => item.scope === 'SHARED').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(document => decorateDocument(data, document, user));
  },
  async setPublication(id, status) {
    return mutate((data, user) => {
      checkSimulatedFailure();
      adminUser(data);
      const document = data.documents.find(item => item.id === id && item.scope === 'SHARED');
      if (!document) throw new ApiError('This shared document is unavailable.', 'DOCUMENT_NOT_FOUND', 404);
      if (status !== 'DRAFT' && status !== 'PUBLISHED') throw new ApiError('Invalid publication status.', 'VALIDATION_ERROR', 400);
      document.status = status;
      document.updatedAt = new Date().toISOString();
      return decorateDocument(data, document, user);
    });
  },
  async listAnnotations(documentId) {
    const data = await authenticatedState();
    const user = currentUser(data);
    accessibleDocument(data, documentId, user);
    return data.annotations.filter(item => item.documentId === documentId && item.userId === user.id).sort((a, b) => a.pageNumber - b.pageNumber || a.createdAt.localeCompare(b.createdAt));
  },
  async getAllAnnotations() {
    const data = await authenticatedState();
    const user = currentUser(data);
    return data.annotations.filter(item => item.userId === user.id).flatMap(annotation => {
      const document = data.documents.find(item => item.id === annotation.documentId && canAccess(item, user));
      return document ? [{ ...annotation, document: decorateDocument(data, document, user) }] : [];
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async createAnnotation(documentId, input) {
    return mutate((data, user) => {
      checkSimulatedFailure();
      const document = accessibleDocument(data, documentId, user);
      validateAnnotation(input, document);
      const now = new Date().toISOString();
      const annotation: Annotation = {
        id: crypto.randomUUID(), userId: user.id, documentId,
        type: input.type, pageNumber: input.pageNumber,
        selectedText: input.type === 'HIGHLIGHT' ? input.selectedText!.trim() : null,
        anchor: input.type === 'HIGHLIGHT' ? input.anchor! : null,
        color: input.type === 'HIGHLIGHT' ? input.color! : null,
        noteText: input.noteText?.trim() ?? '', rowVersion: 1, createdAt: now, updatedAt: now,
      };
      data.annotations.push(annotation);
      return annotation;
    });
  },
  async updateAnnotation(id, input) {
    return mutate((data, user) => {
      checkSimulatedFailure();
      const annotation = ownedAnnotation(data, id, user);
      if (input.rowVersion !== annotation.rowVersion) throw new ApiError('This note changed in another tab. Reload it before saving again.', 'VERSION_CONFLICT', 409);
      const updated: Annotation = { ...annotation, noteText: input.noteText === undefined ? annotation.noteText : input.noteText.trim(), color: annotation.type === 'HIGHLIGHT' ? input.color ?? annotation.color : null };
      validateAnnotation(updated, accessibleDocument(data, annotation.documentId, user));
      updated.rowVersion += 1;
      updated.updatedAt = new Date().toISOString();
      data.annotations = data.annotations.map(item => item.id === id ? updated : item);
      return updated;
    });
  },
  async deleteAnnotation(id) {
    return mutate((data, user) => {
      checkSimulatedFailure();
      if (!data.annotations.some(item => item.id === id)) return;
      ownedAnnotation(data, id, user);
      data.annotations = data.annotations.filter(item => item.id !== id);
    });
  },
  async saveProgress(documentId, page) {
    return mutate((data, user) => {
      validatePage(page, accessibleDocument(data, documentId, user));
      data.progress[`${user.id}:${documentId}`] = page;
    });
  },
};
