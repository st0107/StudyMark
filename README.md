# StudyMark

A React and TypeScript frontend for reading study PDFs, highlighting passages, and keeping private notes. This implementation follows the supplied feature-oriented folder structure. The browser demo is functional; no Spring Boot server or PostgreSQL database is included.

## Run locally

Use Node.js 20.19+ (or a supported newer LTS) and npm.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. `npm ci` also copies PDF.js character maps, fonts, and codecs into `public/pdfjs`. The original sample PDFs are already included; regenerate them with `npm run fixtures` if needed.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

Browser tests use installed Microsoft Edge on Windows. On Linux/macOS, first run `npx playwright install chromium`. An alternative installed browser can be selected with the `PLAYWRIGHT_CHANNEL` environment variable. Tests use isolated browser contexts and a development server on port 5174.

```sh
npm run test:e2e
```

## Try the demo

Use the sign-in screen's account buttons, or sign in with:

| Account | Email | Password |
| --- | --- | --- |
| Alex, student | `alex@studymark.app` | `StudyMark123!` |
| Sam, student | `sam@studymark.app` | `StudyMark123!` |
| Jamie, administrator | `admin@studymark.app` | `StudyMark123!` |

1. Open Java Collections. Select a passage with the mouse and choose a highlight color, or use Add note for a page note.
2. Edit the highlight in the sidebar, change its color, and add a note. Navigate from its page link, zoom, and refresh.
3. Visit My highlights to search, filter, edit, and export your notes as Markdown.
4. Upload a PDF in My PDFs, then rename or delete it through its actions menu.
5. Sign in as Sam to see a separate personal library and annotations.
6. Sign in as the administrator to upload a shared draft and publish/unpublish it. Unpublishing retains students' annotations for republication.

Registration and profile-name changes also work locally. Uploads accept PDFs up to 25 MB and 200 pages. Password-protected, malformed, oversized, or non-PDF inputs produce errors; selected files and note drafts remain available for retries.

## Architecture

```text
src/
  app/
    AppShell/                 Navigation, account menu, responsive layout
    routes/                   Authentication/admin guards, lazy-loaded screens
  features/
    auth/                     Login, registration, session context, settings
    shared-library/           Catalog, cards, search, filters, progress
    personal-library/         Private library and rename/delete dialogs
    pdf-reader/
      PdfToolbar/             Page navigation, zoom, save status
      PdfViewport/            PDF.js canvas and selectable text layer
      AnnotationLayer/        Page-relative highlight overlays
      SelectionToolbar/       Color and selection-note actions
      pdfAnchorAdapter.ts     Selection geometry and serialization
    annotations/
      NotesSidebar/
      AnnotationCard/
      NoteEditor/
      HighlightsPage.tsx     Grouped search, filtering, Markdown export
    uploads/                  File inspection and upload dialog
    admin/                    Shared drafts and publication controls
  shared/
    api/                      Typed mock/HTTP transports, IndexedDB, validation
    types/                    Domain and API contracts
    ui/                       Common loading, branding, error boundary
```

TanStack Query handles asynchronous server state. A small auth context holds the active identity; account changes clear the query cache. Features call a single `StudyMarkApi` interface, so backend integration does not require replacing the screens.

The default mock transport applies account ownership and publication rules and commits metadata and uploaded blobs together in IndexedDB. Concurrent annotation updates use `rowVersion`. No note content is logged. Authenticated reads and mutations check for an account change while asynchronous work is pending.

PDF.js **5.4.624** is pinned with its matching worker and assets, compatible with this project's Node 20 runtime. The reader renders one page at a time and is loaded separately from the library. Canvas, selectable text, geometry capture, annotation storage, and overlays are separate concerns. Anchors use one-based page numbers and normalized rectangles relative to the PDF's intrinsic cropped/rotated viewport. Multi-line highlights contain several rectangles. Document bytes are immutable for a content version.

## Validation

The automated suites cover API account isolation, publication/revocation, annotation CRUD and version conflicts, committed persistence, failed saves, file validation and cleanup, multi-line coordinate scaling, note validation, and retained drafts. Browser coverage checks real PDF rendering, mouse/text-range selection, 75%/150% zoom, resizing, reload/re-login, cropped/rotated PDF upload, private data, note retry, personal rename/delete, mobile navigation, registration, and admin restrictions.

Test output and production-build output are the authority for the current result. Browser screenshots/traces are generated under `.qa` and `test-results` and are excluded from source control.

## Design status and limitations

- The supplied Figma reference could not be inspected: the Figma connector reported its plan tool-call limit, and the browser connector was unavailable. The implemented visual style is provisional and **has not been verified against Figma**. It uses reusable components and responsive layouts, with no substituted Figma asset claims.
- This is browser-local demo storage, not production security. Developer tools can inspect/change demo accounts and data. Use demo information and passwords. Data does not sync across devices; clearing site data removes it. All tabs in one browser share the active account.
- Bundled sample PDFs are public fixtures. Private document bytes must be protected by the future backend. Local account checks do not replace server authorization.
- OCR, cross-page selections, user-controlled PDF rotation, embedded-PDF export, collaborative notes, and offline editing are outside this implementation. Scanned pages can be read and receive page notes but need an existing text layer for highlights.
- Text-selection accessibility depends on the browser's PDF text-layer and caret-navigation support. Page notes and all normal controls are keyboard accessible; comprehensive screen-reader testing remains outstanding.
- An unsaved note survives closing/reopening its sidebar and save errors. Navigating away or reloading discards unsaved drafts. Saved annotations persist.
- The demo paginates its loaded catalog locally. Backend pagination, CSRF/session configuration, request telemetry, and deployed performance measurements remain integration work. Uploaded file validation must be repeated on the server.
- Google Fonts are an optional external font request; system fonts are the fallback. PDF assets and sample material are local.

## Connect Spring Boot

Copy `.env.example` to `.env.local`, set `VITE_API_MODE=http` and `VITE_API_BASE_URL` to the API origin/prefix, then restart Vite. Implement the contract in [docs/API.md](docs/API.md), including its explicitly documented frontend extensions. The HTTP adapter sends cookie credentials and has not yet been exercised against a live backend.

The server must provide session authentication, CSRF protection, ownership checks, validated uploads, private storage/streaming, persistence, and paginated queries. For highlighting behavior, PDF.js's [official rendering examples](https://mozilla.github.io/pdf.js/examples/) and [layer overview](https://mozilla.github.io/pdf.js/getting_started/) informed the display/text/worker separation.
