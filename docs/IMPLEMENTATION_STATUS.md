# StudyMark frontend implementation status

This checklist maps the original product plan to the current **frontend-only** scope. React, TypeScript, Vite, React Router, TanStack Query, PDF.js, and a typed API boundary implement the browser workflow. Figma matching is outside the current scope.

## Requirements

| Plan | Frontend behavior | Verification |
| --- | --- | --- |
| FR-01 Authentication | Register, sign in/out, restore a local session, validate forms, and restrict admin navigation. Pending account work is guarded when the active session changes. | Mock API and auth component tests; registration and route browser tests. |
| FR-02 Shared library | Browse published shared PDFs, search titles, filter subjects, and open the reader. | API publication tests and shared-library browser flows. |
| FR-03 Personal upload | Inspect PDFs up to 25 MB / 1000 pages; upload, rename, and delete private documents. Ownership applies to metadata, bytes, and annotations. | Upload validation and cancellation tests, API isolation tests, browser upload/rename/delete. |
| FR-04 Reader | Render a real PDF canvas and selectable text; navigate pages and zoom. Only the current page renders. | Browser rendering, page navigation, mouse selection, zoom, and mobile checks. |
| FR-05 Highlight | Capture multi-line selections as versioned normalized rectangles; offer five highlight colors. | Anchor unit tests and real-PDF alignment checks at 75% / 150% zoom, resize, and reload. |
| FR-06 Highlight note | Add/edit/remove note text and delete highlights with their notes. | API annotation tests, note editor tests, browser annotation CRUD. |
| FR-07 Page note | Create, edit, and delete notes without selecting PDF text. | Validation tests and browser page-note flows. |
| FR-08 Persistence | Commit annotations and uploaded PDF blobs to IndexedDB; restore saved work after reload and signing back in on the same browser profile. | Persistence tests and browser reload/re-login checks. |
| FR-09 Annotation sidebar | Show the current account's notes for the document; navigate to a page and selected anchor. | Browser account isolation and annotation navigation. |
| FR-10 Edit/delete feedback | Wait for confirmed mutations; preserve failed note drafts, offer retry, and refresh conflicting versions. | Failure/conflict component tests and browser save/retry. |
| FR-11 Admin publishing | Upload a separate shared draft, publish it, and confirm before unpublishing. | API permissions tests and browser shared upload/publication for both student accounts. |
| FR-12 Access revocation | Deny access to unpublished shared metadata/content while preserving annotations for republication. | API revocation tests and browser unpublish/republish. |
| FR-13 Study progress | Save the last-read page per account/document; resume it through library navigation and reload. | Reader regression tests and browser progress checks. |
| FR-14 Library organization | Assign subjects, filter/search the library, sort results, and paginate the local catalog. | Component tests for combined filters, clearing results, and catalog retries; browser subject entry during upload. |
| FR-15 Export notes | Search/filter annotations grouped by document and download the displayed results as Markdown. | Browser export content verification. |

The privacy and authentication behavior above is simulated in browser storage. It does not provide server security or synchronization between devices. Bundled sample PDFs are public fixtures.

## Structure and integration

- `src/app` owns routing, route guards, and the responsive application shell.
- `src/features` separates authentication, shared/personal libraries, uploads, reader rendering, annotations, and administration.
- `src/shared/types` defines document, annotation, anchor, and API contracts.
- `src/shared/api` supplies interchangeable mock and HTTP adapters. Features call the same interface in either mode.

The PDF engine, text-selection geometry, stored anchors, highlight overlays, and annotation forms remain separate. Anchors use one-based pages and rectangles normalized against the intrinsic cropped/rotated PDF viewport. Replacing PDF bytes in place is unsupported because existing anchors belong to an immutable content version.

## Remaining backend work

The user will create the backend. Per the decision on 10 November 2026, all engineering-audit remediation is deferred until the user confirms backend completion. The [post-backend plan](POST_BACKEND_PLAN.md) records the handoff and follow-up sequence for all 25 findings.

The next product phase is Spring Boot and PostgreSQL integration, outside this frontend implementation. Implement the contract in [API.md](API.md), including sessions, CSRF handling, server ownership checks, validated uploads, protected PDF streaming, database migrations, durable file storage, and server pagination. Then exercise the HTTP adapter with real API integration tests and deployed performance measurements.

The browser demo does not implement OCR, cross-page selections, embedded PDF export, collaborative notes, offline editing, or automatic transfer of anchors to replacement PDFs. Unsaved drafts survive sidebar toggles and failed saves; navigation/reload discards them. Comprehensive screen-reader testing remains outstanding.

## Run and verify

```sh
npm install
npm run dev
```

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Browser tests use Microsoft Edge on Windows and Chromium elsewhere; see [README.md](../README.md) for browser installation and demo accounts. Automated results describe the local frontend and mock transport, not a live backend.

Verified on 9 November 2026: TypeScript, ESLint, and the production build passed; all 40 unit/component tests passed. All seven browser workflows passed across the full run and a focused rerun after correcting the shared-publication test's post-login navigation. Desktop reader and mobile library screenshots were also reviewed.
