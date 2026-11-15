import { ApiError } from './errors';
import type { CreateAnnotationInput, StudyDocument } from '../types';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_PDF_PAGES = 1000;
export const HIGHLIGHT_COLORS = ['#FFE066', '#A7E8BD', '#A8D8FF', '#D9C2FF', '#FFB5CA'] as const;

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePassword(password: string): boolean {
  return password.length >= 8 && password.length <= 128;
}

export function validateTitle(value: string): string {
  const title = value.trim();
  if (!title || title.length > 160) {
    throw new ApiError('Enter a title between 1 and 160 characters.', 'VALIDATION_ERROR', 400);
  }
  return title;
}

export async function validatePdfFile(file: File): Promise<void> {
  if (!/\.pdf$/i.test(file.name)) {
    throw new ApiError('Choose a PDF file (.pdf).', 'UNSUPPORTED_PDF', 400);
  }
  if (file.size === 0) throw new ApiError('This file is empty.', 'UNSUPPORTED_PDF', 400);
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError('PDFs must be 25 MB or smaller.', 'FILE_TOO_LARGE', 400);
  }
  const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (signature !== '%PDF-') {
    throw new ApiError('This file does not contain a valid PDF.', 'UNSUPPORTED_PDF', 400);
  }
}

export function validatePage(page: number, document: StudyDocument): void {
  if (!Number.isInteger(page) || page < 1 || page > document.pageCount) {
    throw new ApiError('Choose a page within this document.', 'VALIDATION_ERROR', 400);
  }
}

export function validateAnnotation(input: CreateAnnotationInput, document: StudyDocument): void {
  validatePage(input.pageNumber, document);
  if ((input.noteText?.length ?? 0) > 10_000) {
    throw new ApiError('Notes can contain up to 10,000 characters.', 'VALIDATION_ERROR', 400);
  }
  if (input.type === 'PAGE_NOTE') {
    if (!input.noteText?.trim()) throw new ApiError('Write a note before saving.', 'VALIDATION_ERROR', 400);
    return;
  }
  if (input.type !== 'HIGHLIGHT' || !input.selectedText?.trim() || !input.color || !HIGHLIGHT_COLORS.includes(input.color)) {
    throw new ApiError('Select text and a highlight color first.', 'VALIDATION_ERROR', 400);
  }
  const anchor = input.anchor;
  if (!anchor || anchor.schemaVersion !== 1 || anchor.documentContentVersion !== document.contentVersion || anchor.pageNumber !== input.pageNumber || !anchor.rects.length) {
    throw new ApiError('The selected text has an invalid page anchor.', 'INVALID_ANCHOR', 400);
  }
  for (const rect of anchor.rects) {
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0 || rect.x + rect.width > 1.00001 || rect.y + rect.height > 1.00001) {
      throw new ApiError('The selected text lies outside the PDF page.', 'INVALID_ANCHOR', 400);
    }
  }
}
