# StudyMark API boundary

UI components call the `StudyMarkApi` interface in `src/shared/types/index.ts` through the `api` export in `src/shared/api/index.ts`. Set `VITE_API_MODE=mock` for the default browser demo. Set `VITE_API_MODE=http` and `VITE_API_BASE_URL=/api/v1` to select the HTTP adapter. Changing these Vite settings requires restarting the development server or rebuilding.

## Browser demo

The mock adapter stores documents, annotations, progress, demo accounts, and uploaded PDF blobs in IndexedDB (`studymark-demo-v1`). The active account ID and session revision are stored in localStorage. Every document/annotation operation checks that session and applies ownership/publication rules. Administrators cannot retrieve another account's personal files or annotations. Session revisions prevent pending work from becoming valid again after switching away and back to the same account; PDF downloads are checked again after their response body finishes. Shared-document unpublication hides its annotations without deleting them; republishing restores access. A single IndexedDB transaction commits metadata and blob mutations together. Annotation updates check `rowVersion`, returning `VERSION_CONFLICT` on stale writes.

This simulates application behavior; it is **not a security boundary**. Anyone with browser developer tools can inspect or modify locally stored data and account IDs. Demo password digests are not production password storage. Use only demo information. Data does not sync to another device, and clearing site storage removes it. Bundled sample PDFs are public static assets; a real deployment must serve private content through an authenticated backend. Production authentication, RBAC, ownership enforcement, upload inspection, protected file streaming, request logging, rate limits, and database/storage durability belong to the Spring Boot service.

Demo logins are `alex@studymark.app`, `sam@studymark.app`, and `admin@studymark.app`, all with password `StudyMark123!`. Registrations always create a student. `failNextMockMutation()` rejects the next user mutation before a transaction commits, for testing retry feedback. Progress writes do not consume this injected failure.

## HTTP contract

Requests use cookie credentials (`credentials: include`). JSON requests use `application/json`; upload requests use `FormData` and let the browser supply its multipart boundary. The backend must configure its session, CORS, and CSRF handling before this adapter is used in production. No authentication tokens are stored by the HTTP adapter.

| Method | Route | Response |
| --- | --- | --- |
| POST | `/auth/register` | `User`; accepts `{displayName,email,password}` |
| POST | `/auth/login` | `User`; accepts `{email,password}` |
| POST | `/auth/logout` | 204 |
| GET | `/auth/me` | `User`, or 401 when signed out |
| PATCH | `/auth/me` | `User`; accepts `{displayName}` |
| GET | `/documents?scope=SHARED\|PERSONAL&search=...&subject=...` | `StudyDocument[]` or `{content: StudyDocument[]}` |
| GET | `/documents/{id}` | `StudyDocument` |
| GET | `/documents/{id}/content` | Authenticated PDF bytes |
| POST | `/documents` | `StudyDocument`; multipart `file`, `title`, `subject` |
| PATCH | `/documents/{id}` | `StudyDocument`; accepts `{title}` for owner's personal file |
| DELETE | `/documents/{id}` | 204; deletes personal document and related metadata/bytes |
| GET | `/admin/documents` | Shared `StudyDocument[]` or `{content: StudyDocument[]}` |
| POST | `/admin/documents` | Draft `StudyDocument`; multipart `file`, `title`, `subject` |
| PATCH | `/admin/documents/{id}/publication` | `StudyDocument`; accepts `{status: "DRAFT"\|"PUBLISHED"}` |
| GET | `/documents/{id}/annotations` | Current user's `Annotation[]` |
| GET | `/annotations` | Current user's `(Annotation & {document: StudyDocument})[]` on accessible documents |
| POST | `/documents/{id}/annotations` | `Annotation`; accepts `CreateAnnotationInput` |
| PATCH | `/annotations/{id}` | `Annotation`; accepts `{rowVersion,noteText?,color?}` |
| DELETE | `/annotations/{id}` | 204 |
| PUT | `/documents/{id}/progress` | 204; accepts `{lastPage}` |

`/auth/me`, profile editing, personal document renaming, the admin list, the all-annotations list, and progress are frontend integration extensions to the initial requirements table. They must be implemented or adapted when connecting Spring Boot. List adapters currently consume one response; server pagination controls remain future integration work. The HTTP adapter is a typed integration seam and has not been tested against a live backend.

`StudyDocument.lastPage` is `0` when unread and otherwise a one-based page number. The reader opens unread documents at page 1. `annotationCount` and progress are always specific to the requesting account. A highlight stores one-based `pageNumber`, a versioned `PdfAnchor`, normalized page-relative rectangles, selected text, color, note, timestamps, and `rowVersion`. PDF bytes are immutable per document/content version. A page note has no text anchor. The server determines the user from its authenticated principal, never a client-supplied user ID.

Errors should return `{code, message, requestId?}` with an appropriate HTTP status. The adapter maps these to `ApiError`. Important cases include 401 unauthenticated, 403 forbidden, 404 inaccessible/private documents, 409 version/email conflict, and 400 validation failure. Network failures are surfaced as `NETWORK_ERROR`; successful mutations are awaited before the UI reports a save.

Uploads are limited to 25 MB and 200 pages. The frontend checks extension, PDF signature, size and PDF.js parsing before upload. The backend must independently verify content, page count and supported encryption; client-provided metadata is not trusted authorization or validation evidence. OCR and text selection inside scanned pages are not supported.
