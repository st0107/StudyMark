# StudyMark: frontend mock interview questions and answers

Prepared: 16 November 2026. Based on the current project source.

StudyMark currently has a working React frontend and a browser-local mock API. The Spring Boot backend is not ready. Production integration and the engineering-audit fixes remain deferred; this guide does not claim they have been completed.

These are suggested spoken answers. Adapt first-person statements to the work you actually did. Practise explaining the behavior and opening the relevant code, rather than memorizing every sentence.

## How to prepare

For a short preparation session, start with questions **1, 4, 6, 19, 21–23, 26–27, 29, 32, 38, 41–43, 48, 50, 53 and 57–60**. They cover the project story, its strongest technical decisions, and the limitations an interviewer is likely to probe.

A useful answer structure is: **what the feature does → how the code implements it → why that choice fits → what remains limited**. Most answers below can be delivered in about 30–60 seconds, then expanded with code.

## A. Project introduction and architecture

### 1. Tell me about your project.

**Answer:** StudyMark is a frontend application for studying PDFs. Users can browse shared materials, upload personal PDFs, highlight passages, write notes, and revisit their saved annotations. It uses React, TypeScript, React Router, TanStack Query and PDF.js. The most interesting frontend problem is keeping highlights aligned with PDF text when the page size or zoom changes. The current demo persists data in IndexedDB through a typed mock API; a real backend is planned separately.

### 2. What problem does StudyMark solve, and what can you demonstrate?

**Answer:** It brings the reading material and the student's notes into one workflow. I can demonstrate PDF rendering, multi-line highlights, page notes, editing and deletion, saved annotations after reload, a searchable highlights page and Markdown export. There are separate personal and shared libraries, and an administrator can publish shared materials. These workflows currently run against browser-local demo data, so I would not describe them as a deployed multi-user service.

### 3. Why use this technology stack?

**Answer:** React provides reusable UI components, and TypeScript makes the document, annotation and API contracts explicit. React Router handles screens and reader URLs. TanStack Query manages asynchronous data and cache refreshes. PDF.js provides PDF rendering and text extraction, which would be expensive to implement ourselves. Vite provides development and build tooling. Each tool has a specific responsibility; React itself does not parse PDFs or persist the data.

### 4. Explain your folder architecture.

**Answer:** `src/app` contains routing and the application shell. `src/features` groups code by product capability, such as authentication, libraries, uploads, reading and annotations. `src/shared` contains reusable UI, types and API adapters. This keeps related behavior together and makes it easier to locate changes. For example, a change to highlight coordinates belongs in the reader feature, while a change to HTTP error handling belongs in the shared API layer.

**Code:** [Routes](../src/app/routes/index.tsx), [API contract](../src/shared/types/index.ts).

### 5. How did you split the reader into components?

**Answer:** `PdfReaderPage` coordinates queries, mutations, page navigation and draft state. `PdfToolbar` handles navigation and zoom controls. `PdfViewport` loads and renders PDF pages. `AnnotationLayer` draws stored highlight rectangles, and `SelectionToolbar` acts on a new text selection. `NotesSidebar`, `AnnotationCard` and `NoteEditor` handle annotation presentation and editing. This separation keeps coordinate calculations out of the note form and keeps PDF.js rendering out of the toolbar.

### 6. How do you decide where state belongs?

**Answer:** Temporary UI state, such as zoom, an open dialog or a form value, stays in component state. The current identity is shared through the auth context. Documents and saved annotations use TanStack Query because they come from an asynchronous API. Reader location belongs in the URL when it should be linkable. Filtered lists are derived from the source data and current filters, rather than stored as another independently updated copy.

### 7. Why didn't you use Redux?

**Answer:** The current state is covered by local component state, a small auth context and an asynchronous-data cache. Adding another global store would introduce another place to coordinate the same data. I would reconsider if the application developed complex shared client workflows, such as a workspace-wide draft system or undo history. Redux is a valid option; the decision should follow the state-management problem, not a rule that every React application needs it.

### 8. What are the most technically interesting parts?

**Answer:** I would highlight three areas: converting browser text-selection rectangles into zoom-independent PDF anchors, preventing stale asynchronous work from affecting a different demo account, and keeping annotation mutations consistent with cached library data. These are more substantial than displaying a list of documents because they involve geometry, lifecycle management and concurrency. I can explain the implementation and also show where the audit found remaining edge cases.

## B. React and TypeScript fundamentals in the project

### 9. What is the difference between `useState` and `useRef`?

**Answer:** State is for values that should affect rendered output; setting state schedules a render. A ref preserves a mutable value between renders without scheduling one. The reader uses state for zoom and loading status, and refs for the canvas, text container and PDF host elements. Authentication also uses refs for request counters. Those counters help reject stale results but do not need to appear in the UI.

### 10. What is a controlled component? Where do you use one?

**Answer:** In a controlled input, React state supplies the value and an event handler updates that state. `NoteEditor` controls the note text and selected color. This allows validation, character counts, pending-state disabling and retry behavior to use the same state. The editor initializes its draft from props; it deliberately does not replace the draft on every incoming prop update, because that could overwrite what the user is typing.

### 11. Why do you use effects, and why does cleanup matter?

**Answer:** Effects synchronize a component with something outside React, such as a browser event listener, timer, resize observer or PDF rendering task. Cleanup removes or cancels that work before a replacement effect runs or the component unmounts. In the reader, cleanup disconnects the resize observer and cancels obsolete PDF rendering. Without cleanup, old work could continue consuming resources or try to update a view that now represents a different page.

### 12. What is a stale closure?

**Answer:** A function captures values from the render in which it was created. If it runs later, those values may no longer describe the active screen or account. A delayed page save, for example, still captures the earlier page number. Correct dependencies ensure effects are recreated when needed, while request identifiers and session checks can reject obsolete results. Merely adding dependencies does not guarantee that asynchronous operations finish in the correct order.

### 13. When would you use `useMemo` and `useCallback`?

**Answer:** `useMemo` caches a calculated value, while `useCallback` caches a function reference until its dependencies change. My Highlights memoizes its filtered document groups. The reader keeps the page-count callback stable so passing it into the PDF-loading effect does not cause unnecessary document reloads. These tools are performance and identity tools, not substitutes for correct logic. I would avoid adding them everywhere without a concrete reason.

### 14. Why do React list keys matter? Can keys prevent draft loss?

**Answer:** Keys help React identify items across renders. Document and annotation IDs are better keys than array positions when lists can change order or be filtered. A stable key preserves state while the component remains in the tree, but it cannot preserve state after the component is removed. That distinction matters here: filtering out an editing annotation unmounts its editor, so its local unsaved draft can be lost even though the key was correct.

### 15. What does React Strict Mode do in this application?

**Answer:** The root is wrapped in `React.StrictMode`. In development, Strict Mode performs extra checks, including an additional effect setup-and-cleanup cycle, to reveal missing cleanup and impure behavior. An effect therefore needs to tolerate setup, cleanup and setup again. PDF tasks, event listeners and dialogs need predictable lifecycle handling. I would investigate duplicate development behavior rather than simply remove Strict Mode to hide it.

### 16. How do lazy loading and Suspense help?

**Answer:** The major feature screens use `React.lazy`, and the route tree has a `Suspense` fallback. This allows route code to be loaded when it is needed, instead of making every screen part of the initial route load. The PDF feature is especially suitable because it includes heavier rendering code. Suspense here handles lazy module loading; ordinary document and annotation requests still have their own explicit loading and error states.

### 17. What does your error boundary catch?

**Answer:** The top-level error boundary displays a fallback if a descendant fails during rendering or another lifecycle phase covered by React's boundary mechanism. It does not generally catch errors from event handlers or arbitrary asynchronous callbacks. API calls and form submissions therefore need their own error handling. The current boundary offers reload; exception reporting and more targeted recovery remain improvements.

### 18. What does TypeScript protect you from, and what does it not protect you from?

**Answer:** It checks that application code uses the expected types. For example, `StudyMarkApi` requires both adapters to expose the same methods, and unions restrict document scopes and highlight colors. Strict null checking forces handling of a missing user or anchor. TypeScript does not validate external JSON at runtime: casting a response to `StudyDocument` does not prove its shape. Runtime response validation is an open integration improvement.

**Follow-up:** The annotation model uses a union for `type`, but it is not a fully discriminated union tying each type to required or forbidden fields. Runtime validation currently enforces those relationships; stronger types could make invalid combinations harder to construct.

## C. Queries, mutations and asynchronous behavior

### 19. Why use TanStack Query, and how do you design query keys?

**Answer:** It manages asynchronous loading, errors, cached results and refetching. The same interface is useful even while the data comes from the mock API. Query keys describe the resource and its identity, for example:

```ts
["document", user?.id, documentId][("annotations", user?.id, documentId)][
  ("documents", user?.id, scope)
];
```

Including the user ID separates account-specific cache entries. This is a cache-correctness measure, not authorization. Account changes also clear the query cache.

### 20. What is cache invalidation? What are your current cache settings?

**Answer:** Invalidation marks matching cached queries stale and normally refetches active matches. After an annotation changes, the reader invalidates document annotations, the all-annotations view and the library list so related counts and displays refresh. The global query configuration uses a 30-second stale time, one retry and refetching on window focus. Immutable PDF content uses an infinite stale time. Stale time controls freshness; it is not a promise that data stays in memory forever.

### 21. Do you use optimistic updates?

**Answer:** Annotation saves currently wait for the API mutation and then refresh related queries. The editor shows a pending state and stays available on failure, rather than immediately presenting the change as persisted. This makes failure handling straightforward for study notes. Optimistic updates could make some actions feel faster, but they would require temporary state, rollback and reconciliation. Mutations are not automatically retried by the global Query configuration.

### 22. How do you prevent one edit from silently overwriting another?

**Answer:** An annotation has a `rowVersion`. An update sends the version it was based on; the mock adapter compares it with the stored version and returns a version-conflict error if they differ. A successful update increments the version. The UI refreshes conflicting data so a retry can use the current version. This is optimistic concurrency control, which is different from an optimistic UI update. It does not automatically merge two people's text changes.

**Limit:** Conflict refresh only retains a draft while its editor stays mounted. Filtering can still remove it, and that defect is documented.

### 23. How do you handle asynchronous work when the user changes accounts?

**Answer:** The mock API captures both the user ID and a session revision, then checks whether they still match around asynchronous work. The revision matters for an A → B → A sequence: matching user IDs alone would incorrectly make an old request look current again. `AuthProvider` also uses request counters to ignore stale session and profile responses. These safeguards exist in the demo; equivalent HTTP session-expiry and cross-tab behavior still needs integration work.

### 24. Does `async/await` make work run on another thread?

**Answer:** No. `await` suspends that async function while its promise settles, allowing other work to proceed; it does not move JavaScript computation to a worker. Heavy synchronous work before or after an `await` can still block the UI. Promise continuations run through the microtask queue. PDF.js uses a worker for relevant PDF processing, while this application still coordinates DOM layers and canvas rendering on the UI side.

### 25. Why use `Promise.all`? Does it cancel the remaining work on failure?

**Answer:** It waits for independent promises together and rejects if one rejects. In the PDF viewport, canvas rendering and text-layer work are awaited together. In mutation callbacks, independent query invalidations can also run together. `Promise.all` does not cancel the other tasks when one fails; cancellation must be implemented separately. Attaching rejection handlers promptly also matters when a render can be cancelled before another asynchronous step completes.

### 26. Why debounce reading-progress saves? Does that solve ordering?

**Answer:** The reader delays a progress save by 350 milliseconds so rapid page changes do not immediately produce a write for each intermediate page. Cleanup removes a timer that has not fired. However, once writes start, they can complete out of order. The audit reproduced an older page save finishing after a newer one and becoming the stored position. A proper follow-up is to serialize or coalesce writes and define backend ordering; debounce alone is insufficient. Leaving before the timer fires can also miss the final position.

### 27. Are unsaved drafts always preserved?

**Answer:** No. The editor keeps its local text after a failed save, and hiding the notes sidebar keeps it mounted so the draft survives that toggle. Navigation or reload discards unsaved drafts. Filtering out an editing card, including after a conflict refresh, can also unmount it and lose the draft. A future fix could lift drafts into a store keyed by account, document and annotation, then add an explicit navigation or recovery policy.

### 28. Why store reader page and annotation IDs in the URL?

**Answer:** A URL such as `/reader/<documentId>?page=3&annotation=<annotationId>` can identify the reading location and selected annotation. My Highlights uses this to navigate to the right passage. The reader clamps page input to valid bounds and falls back to stored progress when appropriate. Page changes replace the current history entry, avoiding a long Back-button history for every page turn. Zoom and panel visibility remain local UI state.

## D. PDF rendering and annotation geometry

### 29. Walk me through opening a PDF.

**Answer:** The reader first queries document metadata. Once that succeeds, content and annotation queries are enabled. The content adapter returns a `Blob`; `PdfViewport` converts it into bytes and opens it through PDF.js. For the current page, it computes a viewport, renders the canvas and creates a selectable text layer. Stored annotations are drawn over the page using normalized rectangles. The current implementation renders one page at a time and fetches the complete PDF, rather than loading byte ranges.

### 30. Why do you need both a canvas and a text layer?

**Answer:** Canvas gives the visual appearance of the PDF page, but its pixels do not provide normal DOM text selection. PDF.js's text layer places text elements over the canvas so the browser can select passages. A separate annotation layer displays saved highlights. Keeping all three aligned with the same page viewport is essential. The text layer enables selection, but it does not by itself establish complete screen-reader accessibility.

### 31. How do you capture a user's text selection?

**Answer:** The adapter reads `window.getSelection()`, gets its range and checks that both ends belong to the current page's text layer. It rejects collapsed, empty or excessively long selections. It gets the range's client rectangles, clips them to the page and normalizes their coordinates. The result includes selected text, a page anchor and a screen position for the selection toolbar. Selections spanning multiple pages are outside the current scope.

### 32. How do highlights stay aligned when the page resizes?

**Answer:** I store positions as fractions of the displayed page dimensions rather than raw screen pixels. For a selected rectangle:

```ts
x = (selectionLeft - pageLeft) / pageWidth;
y = (selectionTop - pageTop) / pageHeight;
width = selectionWidth / pageWidth;
height = selectionHeight / pageHeight;
```

The annotation layer renders these as percentages. If a rectangle begins 100 pixels into a 1,000-pixel page, its `x` is `0.1`; on a 600-pixel page, it begins 60 pixels in. This works while the page geometry and document content remain the same.

**Code:** [Anchor calculations](../src/features/pdf-reader/pdfAnchorAdapter.ts), [highlight overlay](../src/features/pdf-reader/AnnotationLayer/index.tsx).

### 33. Why store multiple rectangles for one highlight?

**Answer:** A multi-line selection consists of several text fragments. One large bounding rectangle could also cover whitespace or unrelated text between those fragments. `Range.getClientRects()` returns the smaller rectangles needed to preserve the selection's shape. The adapter clips invalid portions, ignores tiny rectangles and removes duplicates. One annotation then contains an array of rectangles rather than pretending every selection is a single box.

### 34. What is the difference between zoom and device pixel ratio?

**Answer:** Zoom changes the page's displayed size. Device pixel ratio relates CSS pixels to the canvas backing resolution used for sharper rendering. The viewport computes a fit-related scale and multiplies it by the selected zoom. It then sizes the canvas backing buffer using a device-pixel ratio capped at two while retaining the intended CSS dimensions. This reduces excessive scaling on dense displays, but it is not a total canvas-memory budget for unusually large pages.

### 35. How do rotated pages and document changes affect anchors?

**Answer:** Rendering and selection use the same PDF.js viewport, which includes the PDF page's intrinsic crop and rotation. The anchor stores the document content version as well as the page number and schema version. The viewport only displays anchors matching the current content version. Replacing PDF bytes could change every text position, so automatic transfer of anchors is not supported. Stored quote text provides context, but no fuzzy quote-based re-anchoring algorithm is implemented.

### 36. How do you manage PDF.js workers and rendering cleanup?

**Answer:** The worker URL comes from the same installed PDF.js package as the display code, and PDF.js is pinned to an exact version. Local font, character-map and codec assets are configured through a wrapper. Loading tasks are destroyed on cleanup, and obsolete canvas and text-layer tasks are cancelled. A disposed flag prevents late callbacks from updating abandoned work. This manages resources and stale results; it does not claim every PDF workload has already been performance-tested.

### 37. Can StudyMark highlight scanned PDFs?

**Answer:** Only when the PDF has a usable text layer. An image-only scan can still be rendered, but there may be no text for the browser to select. The reader detects pages with no selectable text and suggests a page note. OCR would be a separate feature involving text recognition and geometry alignment. It is not implemented, so I would not demonstrate an image-only PDF as if text highlighting were supported.

## E. Uploads, storage and backend boundaries

### 38. How do you validate a PDF upload?

**Answer:** The client checks the `.pdf` extension, nonzero size, the size limit and the `%PDF-` signature. PDF.js then opens the document, checks the actual page count and parses the first page to catch some damaged structures. Password-protected and unsupported inputs produce errors, and the temporary loading task is destroyed. Current source limits are **25 × 1,024 × 1,024 bytes** and **1,000 pages**. These checks improve feedback; the future server must independently validate uploads and enforce its own constraints.

**Code:** [Validation constants](../src/shared/api/validation.ts), [PDF inspection](../src/features/uploads/validateUpload.ts).

### 39. Why IndexedDB instead of putting everything in localStorage?

**Answer:** IndexedDB supports asynchronous access, structured data, blobs and transactions, making it a better fit for PDFs and annotations. localStorage is synchronous and string-based; this demo uses it only for the active session ID and revision. IndexedDB data survives ordinary reloads, but it belongs to that browser and origin. It is not a cross-device database or a backup, and clearing site data can remove it.

### 40. How do you keep uploaded files and metadata consistent?

**Answer:** The mock storage layer writes application state and file blobs through a single read/write IndexedDB transaction across the `data` and `files` stores. It resolves success only when the transaction completes. If the operation fails or aborts, it rejects instead of announcing success after an individual request. This prevents partial commits within that transaction. The current state is stored as one aggregate object, which is simple for a demo but would need reconsideration at larger scale.

### 41. Is the current authentication production-secure?

**Answer:** No. The demo stores an account ID in localStorage and simulates authentication and ownership rules in browser code. Someone with developer tools can inspect or change that state. The demo password digest avoids storing entered passwords as plain text, but it is not a production password-storage design. The planned backend must provide real authentication, server-enforced authorization, protected files and durable persistence. I would use only demo information in the current app.

### 42. How do student/admin permissions and private annotations work?

**Answer:** Route guards restrict admin screens, and the mock API separately checks operations. A student sees published shared materials and their own personal PDFs. An administrator can manage shared publication but does not receive another account's personal files through the mock API. Annotation operations check their owner. Unpublishing a shared document hides access while preserving notes for republication. These are functional simulations; route guards and browser checks do not replace server authorization.

### 43. How will you connect the real backend?

**Answer:** Features call `StudyMarkApi`, with mock and HTTP implementations selected at the API boundary. The HTTP adapter already describes document, annotation, session and publication requests. Configuration selects HTTP mode and its base URL. However, switching an environment variable is only the start: the actual API contract, session behavior, response validation, pagination, cancellation and retry handling must be integrated and tested. The backend is being developed separately and is not ready yet.

**Code:** [HTTP adapter](../src/shared/api/http.ts), [API documentation](API.md).

### 44. Why send cookie credentials? What about CORS and CSRF?

**Answer:** The HTTP adapter uses `credentials: 'include'` for the planned cookie-session contract. Cross-origin requests also need compatible server CORS and cookie settings; the browser does not grant access just because that fetch option is present. Cookie authentication requires a deliberate CSRF protection strategy for state-changing requests. This adapter does not yet implement a CSRF token handshake. Those details must be agreed with and verified against the backend before real integration is considered complete.

### 45. How do you think about XSS and frontend secrets?

**Answer:** Notes and selected text are rendered as ordinary React text rather than inserted as raw HTML, which avoids interpreting those strings as markup in these views. That is useful, but it does not prove the whole application is immune to XSS. I would review every HTML or URL rendering boundary. Frontend configuration is delivered to the browser: `VITE_*` values must not contain private server credentials. The API base URL is configuration, not a secret.

## F. User experience, accessibility and testing

### 46. How is the application responsive?

**Answer:** CSS changes the library and navigation layout at smaller widths. The main navigation becomes a mobile drawer. In the reader, `ResizeObserver` measures the available content width and triggers page rescaling; the notes panel is initially closed on narrower screens. I would verify this with actual interactions and different viewport sizes, not only a screenshot. Responsive rendering also needs keyboard and accessible-name checks because hiding visible text can remove a control's name.

### 47. Why is the reader outside the main application shell?

**Answer:** Reading needs as much space as possible for the PDF and its notes. The reader route remains protected, but it is a sibling of the `AppShell` route instead of a child. That removes the workspace sidebar and header during reading while retaining a reader toolbar and a back-to-library action. It also keeps the layout decision in routing, rather than spreading special cases through every part of the shell.

### 48. What accessibility work exists, and what remains?

**Answer:** The app uses semantic controls, form labels, accessible names on many icon buttons, status/error announcements, a skip link and focus handling for mobile navigation. It also uses native dialogs for relevant forms. However, the audit found low-contrast text, a missing accessible name on the mobile Add note control, a missing visible focus indicator and incomplete route focus handling. Screen-reader verification is still outstanding. I would describe accessibility as partially implemented, not claim WCAG conformance.

### 49. How do you handle loading, empty and failure states?

**Answer:** These states have different meanings and should have different UI. The library shows loading placeholders, an empty-library or no-matches message, and a retry action for load failure. The reader distinguishes opening a document from rendering a page and reports unavailable documents. Note and upload forms keep their input after supported failure paths so the user can retry. A success message is based on a completed operation, rather than merely a click.

### 50. What is your testing strategy?

**Answer:** Pure logic is covered with unit tests, such as selection normalization and validation. Component tests check visible behavior like retained form drafts and library filters. Mock API tests cover persistence, ownership, publication and version conflicts. Playwright tests exercise real PDF rendering, selection, zoom, notes, uploads and navigation in a browser. These layers complement each other: a passing geometry function test does not prove the rendered text and highlight align in a real browser.

### 51. Why mock dependencies in some tests but use real PDFs in others?

**Answer:** Mocking PDF.js lets an upload test precisely simulate password errors, parsing failures or an excessive page count without depending on a complex real file. `fake-indexeddb` supports storage tests outside a browser. Those tests are fast and controlled, but they cannot establish actual visual rendering. Browser tests use real fixture PDFs to check that the application and the rendering library work together. I would choose the least expensive test that can verify the behavior faithfully.

### 52. How do you test highlight accuracy?

**Answer:** Unit tests verify normalization and coordinate conversion with known page bounds. Browser tests select actual text and compare the highlight overlay to the selected text range under zoom, resizing and reload. The comparison should use the selected range's geometry, not assume that a parent text span's line box is identical. Cropped and rotated PDF fixtures cover additional cases. The existing checks are evidence for those fixtures, not proof that every PDF's text extraction will behave identically.

### 53. Can you say all tests currently pass?

**Answer:** I should only claim a current pass after a fresh run. The audit recorded 40 unit/component tests and seven browser workflows passing on 10 November 2026. During preparation, source review found an upload-test fixture still using **201 pages** while expecting rejection against the current **1,000-page** limit. That fixture is inconsistent with the current rule. No suites were rerun to prepare this guide, and the mismatch has not been fixed in this task.

**How I would address it when authorized:** Test a document at the limit and one above the limit, with appropriate PDF mocks, then rerun the relevant suite. Also reconcile older documentation that still mentions a 200-page limit.

## G. Tradeoffs, debugging and discussion

### 54. How do you build and deploy the frontend? Why are SPA rewrites needed?

**Answer:** `npm run build` runs the TypeScript build check and Vite build. `npm run preview` can serve the built output locally for inspection. With browser-history routing, a direct request to `/reader/...` must return the application entry point so React Router can resolve the screen. The repository's Vercel configuration supplies a catch-all rewrite. A real deployment still needs correct asset/API routing and response headers; a rewrite alone is not the complete deployment setup.

### 55. What would you change if the project had many documents and annotations?

**Answer:** First I would measure representative workloads. The current library filters and paginates the loaded list locally, eight items per page, and My Highlights loads all matching account data before local filtering. Larger datasets would need server pagination and query-aware filtering. The PDF path fetches the entire file and lacks a total canvas-pixel budget. Range loading, bounded rendering and virtualization are possible improvements, but I would choose them based on measured bottlenecks rather than inventing performance gains.

### 56. Explain a bug you can discuss technically.

**Answer:** A strong example is the reading-progress race found in the audit. Suppose page 2 starts saving, then page 3 starts saving. If page 3 finishes first and page 2 finishes later, the stored reading position becomes stale. Debouncing reduces how often requests start but does not order requests already in flight. I can explain the reproduction and propose serialized/coalesced writes plus backend ordering. I would explicitly say this is an identified defect awaiting remediation, rather than claim it is fixed.

**Alternative:** Explain the completed layout change that moved the reader outside `AppShell`, removing the workspace sidebar from reading mode.

### 57. Is this production-ready? What are the biggest remaining gaps?

**Answer:** It is a functional frontend MVP, not a production-ready private document service. The backend, real authentication and durable protected storage are not available yet. The audit also found draft-loss paths, progress ordering, accessibility defects and HTTP integration gaps. Tooling, reproducible installation, CI, observability and broader browser/performance verification need follow-up. Those findings are recorded, and the agreed plan is to address them after the backend handoff. Knowing these limits helps me describe the project accurately.

### 58. What would you improve first after backend completion?

**Answer:** I would compare the actual backend contract with the frontend interface, then prioritize protecting user work and making controls usable. That includes unsaved drafts, progress ordering and the confirmed accessibility/navigation issues. I would also establish reproducible tooling and CI, complete the HTTP session and error contracts, and verify the integrated application. The exact order is recorded in the post-backend plan; I would update it based on what the completed backend actually supplies.

### 59. How would you demonstrate the project in five minutes?

**Answer:** I would start by stating the frontend and mock-backend scope. Then I would open a shared PDF, select text, save a highlight and note, change zoom and reload to show saved persistence. Next I would use My Highlights to find the annotation, jump back to it and export notes. If time permits, I would show a personal upload or shared publication. I would finish with the architecture and one honest limitation rather than trying to show every screen.

### 60. How should you describe your contribution or use of AI assistance?

**Answer:** Describe what you actually designed, implemented, reviewed and tested. If AI or other assistance was used, explain its role accurately and distinguish generated suggestions from work you understand and verified. For example, if true: “I used assistance for parts of implementation and review, and I can explain the resulting data flow, validate it and discuss its tradeoffs.” Avoid claiming independent authorship or verification you did not perform. Be prepared to navigate the code and reason through a small change.

## H. Ten common frontend follow-up questions

### 61. How do props differ from state?

**Answer:** Props are inputs supplied by a parent; state is data owned by a component across renders. `PdfToolbar` receives the current page as a prop and reports navigation through a callback. It also keeps local input text so a user can type a page number before committing it. Child components should not mutate their props.

### 62. Why avoid mutating arrays or objects used as React state?

**Answer:** Immutable updates provide new references so changes can be detected reliably and previous values are not accidentally modified. A spread creates only a shallow copy; nested values still require care. In the library, `.filter()` creates a new array before `.sort()` mutates that result, so sorting does not reorder the original cached array. I would not call `.sort()` directly on Query-owned data.

### 63. What is the difference between `map`, `filter`, `find` and `reduce`?

**Answer:** `map` transforms each item, `filter` keeps matching items, `find` returns the first match or `undefined`, and `reduce` accumulates a result. StudyMark uses filtering for search and subjects, mapping for document cards and `find` for a continue-reading candidate. I would choose the operation that makes the intended behavior clear, rather than use `reduce` for every transformation.

### 64. What is event bubbling? How do `preventDefault` and `stopPropagation` differ?

**Answer:** Many DOM events bubble from their target to ancestors. `preventDefault()` stops a default browser action, such as a form submission navigating away; `stopPropagation()` stops propagation to other elements. They solve different problems. StudyMark prevents normal form navigation when handling saves and uses parent navigation click handlers to close the mobile menu. That parent handler does not cover a logo outside the navigation element, which explains one documented mobile-menu bug.

### 65. What is the difference between debouncing and throttling?

**Answer:** Debouncing delays work until input has settled for a period; throttling limits how frequently work can run during continuous activity. The progress timer is debounced. Search currently filters the loaded local list on each change; it is not a debounced server search. If search moved to the backend, I would consider debouncing, cancellation and stale-response protection together.

### 66. When does `fetch` reject, and why check `response.ok`?

**Answer:** `fetch` can resolve with an HTTP error response such as 404 or 500; those statuses do not normally reject the promise. The adapter checks `response.ok` and throws an application error for unsuccessful responses. Network failures reject, and parsing the response body can fail separately. The current JSON cast does not validate the body, so malformed responses remain a boundary-hardening task.

### 67. How are Flexbox, Grid and absolute positioning useful here?

**Answer:** Flexbox is useful for arranging controls along a row or column, while Grid is useful for a document-card layout with rows and columns. Absolute positioning is appropriate for highlight rectangles inside the page's positioned container because their coordinates refer to that page. It would be less suitable as the primary layout method for the whole application. The layout choice should match the relationship between the elements.

### 68. How would you debug a CSS rule that does not apply?

**Answer:** I would inspect the element and its computed styles, then check the cascade, selector specificity, source order, media queries and inherited values. I would also verify whether the problem is the element's containing block or size rather than the declaration itself. I would not immediately add `!important`. The missing search focus indicator is a good example of why a general focus rule must be checked against component-specific outline rules.

### 69. How do you create the Markdown download, and why revoke its URL?

**Answer:** My Highlights builds text from the currently filtered groups, creates a Markdown `Blob`, creates an object URL and clicks a download link pointing to it. The URL is revoked afterward so the browser can release the associated resources. The exported results reflect the current filters; this is not an export of an annotated PDF file. Markdown rendering and sanitization in a separate consuming application would be a separate concern.

### 70. How would you investigate a slow interaction?

**Answer:** I would reproduce it with a representative document and identify whether the delay is network, JavaScript, React rendering, PDF work or browser layout/paint. Browser performance tools, the network panel and React profiling can help separate these causes. Then I would change the responsible path and compare the same scenario again. I would not claim a percentage improvement without measurements or add memoization before identifying the bottleneck.

## Five-minute presentation outline

| Time      | Show                                | Explain                                                                                        |
| --------- | ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| 0:00–0:30 | Shared library                      | The study workflow, stack and browser-local demo boundary.                                     |
| 0:30–1:45 | PDF reader                          | Text selection, multi-line highlight and a saved note.                                         |
| 1:45–2:30 | Zoom and reload                     | Normalized coordinates and persistence of saved annotations. Wait for saves before navigating. |
| 2:30–3:15 | My Highlights                       | Search, jump to an annotation and Markdown export.                                             |
| 3:15–4:00 | Personal upload or admin publishing | Demonstrate one additional workflow with a prepared fixture.                                   |
| 4:00–5:00 | Code and limitations                | Feature boundaries, API interface, one concurrency issue and the backend plan.                 |

## Demo preparation checklist

- Run `npm run dev` before the interview and use the URL Vite prints. Use the mock mode for this presentation.
- Prepare a small PDF with selectable text. Use demo information and accounts.
- Practise the exact workflow once, including saving before reload or navigation.
- Have the geometry adapter, reader, auth provider and API interface ready to open in the editor.
- Recheck tests before making any current passing-test claim. The upload test mentioned in question 53 needs attention; this guide does not change it.
- If asked about all audit findings, open the existing report rather than suggesting that they are resolved.
- Avoid quoting unmeasured load times, user capacity, accessibility compliance or production-security guarantees.

Verification commands, for when you are ready to check the current code:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

The browser suite currently uses Microsoft Edge by default on Windows and Chromium elsewhere, with one worker. It is not a configured multi-browser test matrix. No test or build run was performed as part of writing this guide.

## Quick code reference

| Topic                                          | File                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Providers and Query defaults                   | [src/main.tsx](../src/main.tsx)                                                                                  |
| Protected routes and reader layout             | [Routes](../src/app/routes/index.tsx)                                                                            |
| Shared identity and request counters           | [AuthProvider](../src/features/auth/AuthProvider.tsx)                                                            |
| Domain models and adapter contract             | [Shared types](../src/shared/types/index.ts)                                                                     |
| Mock ownership, session revision and conflicts | [Mock API](../src/shared/api/mock.ts)                                                                            |
| IndexedDB transactions                         | [Storage](../src/shared/api/storage.ts)                                                                          |
| Reader orchestration and progress timer        | [PdfReaderPage](../src/features/pdf-reader/PdfReaderPage.tsx)                                                    |
| PDF loading, scaling and cleanup               | [PdfViewport](../src/features/pdf-reader/PdfViewport/index.tsx)                                                  |
| Selection geometry                             | [pdfAnchorAdapter](../src/features/pdf-reader/pdfAnchorAdapter.ts)                                               |
| Drafts and save feedback                       | [NoteEditor](../src/features/annotations/NoteEditor/index.tsx)                                                   |
| Filtering, grouping and Markdown export        | [HighlightsPage](../src/features/annotations/HighlightsPage.tsx)                                                 |
| File inspection and current test mismatch      | [Inspection](../src/features/uploads/validateUpload.ts), [tests](../src/features/uploads/validateUpload.test.ts) |
| Real browser workflows                         | [Playwright tests](../e2e/studymark.spec.ts)                                                                     |
| Findings and deferred follow-up                | [Engineering audit](ENGINEERING_AUDIT.md), [post-backend plan](POST_BACKEND_PLAN.md)                             |

## A short closing statement to practise

“StudyMark demonstrates a complete frontend study workflow, including a real PDF renderer and persistent local annotations. Its strongest technical areas are selection geometry, asynchronous state and component boundaries. I can explain the implementation and its tradeoffs, and I have documented the remaining issues. The next phase is backend integration followed by the planned reliability, accessibility and production-readiness work.”
