export type UserRole = 'USER' | 'ADMIN';
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export type DocumentScope = 'SHARED' | 'PERSONAL';
export type DocumentStatus = 'ACTIVE' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export interface StudyDocument {
  id: string;
  title: string;
  description: string;
  subject: string;
  scope: DocumentScope;
  status: DocumentStatus;
  uploadedBy: string;
  pageCount: number;
  sizeBytes: number;
  contentVersion: number;
  createdAt: string;
  updatedAt: string;
  lastPage: number;
  annotationCount: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface PdfAnchor {
  schemaVersion: 1;
  documentContentVersion: number;
  pageNumber: number;
  rects: NormalizedRect[];
  quote?: { exact: string; prefix?: string; suffix?: string };
}
export type HighlightColor = '#FFE066' | '#A7E8BD' | '#A8D8FF' | '#D9C2FF' | '#FFB5CA';
export interface Annotation {
  id: string;
  userId: string;
  documentId: string;
  type: 'HIGHLIGHT' | 'PAGE_NOTE';
  pageNumber: number;
  selectedText: string | null;
  anchor: PdfAnchor | null;
  color: HighlightColor | null;
  noteText: string;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}
export interface CreateAnnotationInput {
  type: Annotation['type'];
  pageNumber: number;
  selectedText?: string | null;
  anchor?: PdfAnchor | null;
  color?: HighlightColor | null;
  noteText?: string;
}
export interface UpdateAnnotationInput {
  rowVersion: number;
  noteText?: string;
  color?: HighlightColor;
}
export type AnnotationWithDocument = Annotation & { document: StudyDocument };
export interface ListDocumentsInput {
  scope: DocumentScope;
  search?: string;
  subject?: string;
}
export interface UploadDocumentInput {
  file: File;
  title: string;
  subject: string;
  pageCount: number;
  scope?: DocumentScope;
}
export interface LoginInput { email: string; password: string }
export interface RegisterInput extends LoginInput { displayName: string }
export interface StudyMarkApi {
  getSession(): Promise<User | null>;
  login(input: LoginInput): Promise<User>;
  register(input: RegisterInput): Promise<User>;
  logout(): Promise<void>;
  updateProfile(input: { displayName: string }): Promise<User>;
  listDocuments(input: ListDocumentsInput): Promise<StudyDocument[]>;
  getDocument(id: string): Promise<StudyDocument>;
  getDocumentContent(id: string): Promise<Blob>;
  uploadDocument(input: UploadDocumentInput): Promise<StudyDocument>;
  renameDocument(id: string, title: string): Promise<StudyDocument>;
  deleteDocument(id: string): Promise<void>;
  listAdminDocuments(): Promise<StudyDocument[]>;
  setPublication(id: string, status: 'DRAFT' | 'PUBLISHED'): Promise<StudyDocument>;
  listAnnotations(documentId: string): Promise<Annotation[]>;
  getAllAnnotations(): Promise<AnnotationWithDocument[]>;
  createAnnotation(documentId: string, input: CreateAnnotationInput): Promise<Annotation>;
  updateAnnotation(id: string, input: UpdateAnnotationInput): Promise<Annotation>;
  deleteAnnotation(id: string): Promise<void>;
  saveProgress(documentId: string, page: number): Promise<void>;
}
