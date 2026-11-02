import { httpApi } from './http';
import { mockApi } from './mock';

export const isMockApi = import.meta.env.VITE_API_MODE !== 'http';
export const api = isMockApi ? mockApi : httpApi;
export { ApiError, errorMessage } from './errors';
export { DEMO_ACCOUNTS, DEMO_PASSWORD } from './seed';
export { failNextMockMutation } from './mock';
export { HIGHLIGHT_COLORS, MAX_PDF_PAGES, MAX_UPLOAD_BYTES, validateEmail, validatePassword, validatePdfFile } from './validation';
