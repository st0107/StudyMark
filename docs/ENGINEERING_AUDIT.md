# StudyMark engineering audit

Date: 10 November 2026. Reviewed working tree: commit `0513592` plus no application changes during this audit.

## Verdict and scope

StudyMark is a functional frontend MVP, with useful engineering foundations, but it is not ready to claim full production readiness or WCAG conformance. Passing the existing tests verifies those workflows, not every quality requirement. This report lists the substantiated defects, integration blockers, and engineering gaps found in this review. It is not a certification that every possible defect has been found.

The agreed implementation scope is frontend-only. Spring Boot, PostgreSQL, production authentication and protected file storage were deliberately deferred. Figma matching, OCR, cross-page selections, collaborative notes and offline editing are not counted as missing requirements.

Application files were not modified. Audit probes used isolated browser contexts; their temporary data did not affect the user's browser profile.

## Verification performed

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed |
| Unit/component suite | 40 passed across 10 files |
| Production build | Passed |
| Existing Playwright suite | 7 passed in Microsoft Edge |
| Additional reader probes | Reproduced draft loss under filtering/conflict and stale progress after delayed writes |
| Additional accessibility/navigation probes | Reproduced unnamed mobile button, missing search focus indicator, unchanged route title/focus, and mobile menu remaining open after logo navigation |
| Full npm dependency audit | 10 flagged dependency entries: 2 critical, 8 moderate, all in development tooling |
| Production-only npm audit | 0 reported vulnerabilities in the installed production dependency tree |

Evidence is retained locally in `.qa/audit-tests.log`, `.qa/audit-build.log`, `.qa/audit-typecheck.log`, `.qa/audit-lint.log`, `.qa/audit-e2e.log`, `.qa/reader-audit-results.json`, `.qa/a11y-audit-results.json`, and the two `.qa/dependency-audit*.json` files. These files are ignored by Git. Zero reported production advisories does not establish that the application is secure.

## Findings

Priority is the recommended remediation order, not a claim that every item is a current exploit. **Confirmed** means reproduced or directly demonstrated by source/configuration. **Integration** means the gap must be resolved before connecting a real backend. **Improvement** identifies an engineering safeguard without claiming a demonstrated runtime failure.

### 01 — Production security and durable persistence are deferred

**High · Deferred product phase.** Accounts, role decisions, metadata and uploaded files live in browser storage. The active identity is a locally editable ID; the mock password digest is a SHA-256 demonstration, not a production password-storage implementation. Shared sample PDF URLs are public. There is no server-enforced ownership, session lifecycle, durable multi-device storage or backup/restore implementation.

Evidence: [API selection](../src/shared/api/index.ts), [mock identity checks](../src/shared/api/mock.ts), [storage](../src/shared/api/storage.ts), [demo password digest](../src/shared/api/seed.ts) lines 12–15, and [documented boundary](API.md).

Required before real-user release: the planned backend, password hashing through an appropriate password KDF, secure sessions, ownership enforcement for metadata and bytes, validated uploads, durable storage, retention and recovery procedures. This is an acknowledged scope boundary, not a hidden defect in the mock demonstration.

### 02 — HTTP session expiry and cross-tab account changes are not handled centrally

**High · Integration.** `AuthProvider` restores the session on mount and responds to storage changes only in mock mode. Ordinary HTTP 401 responses throw an error without clearing the authenticated user/cache. If another tab changes a cookie-backed account, an already-open tab can retain user A's identity while requests use user B's cookie; returned data can then be associated with A's query keys. Query refetch-on-focus does not revalidate the auth context.

Evidence: [AuthProvider](../src/features/auth/AuthProvider.tsx) lines 24–46, [HTTP transport](../src/shared/api/http.ts) lines 17–22 and 38–40, [query configuration](../src/main.tsx) line 10.

Remediation: central unauthorized handling, session revalidation, account-change broadcasting, cache invalidation and cancellation tied to a verified session identity. The exact backend behavior remains untested because no backend is present.

### 03 — Cookie-authenticated requests have no CSRF integration contract

**High · Integration.** Requests use `credentials: include`, including multipart uploads, but there is no CSRF token acquisition/header integration or documented tested alternative policy in the client/server pair.

Evidence: [HTTP transport](../src/shared/api/http.ts) lines 9–12 and 55–60. [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) describes appropriate protections for cookie-authenticated applications.

Remediation: agree and implement Spring Security's CSRF flow or another justified, tested server policy. Absence of a client token alone does not prove a deployed server is exploitable; no server was audited.

### 04 — Installed development dependencies have unresolved advisories

**High · Confirmed dependency hygiene gap.** The npm audit flagged 10 dependency entries: 2 critical and 8 moderate. Installed Vitest is 3.2.7 and Tinypool is 1.1.1; advisories also involve the mocker and minimatch/typescript-eslint chain. These counts include transitive and propagated findings, not ten independent demonstrated exploits.

Evidence: [package manifest](../package.json) and `.qa/dependency-audit.json`. Relevant advisories: [Tinypool worker options](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3), [Tinypool run options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr), and [Vitest mock redirect](https://github.com/advisories/GHSA-82fw-gwwq-j7x9).

Remediation: review patched compatible versions, update deliberately and rerun checks; do not blindly force npm's suggested changes. Tinypool exploitation requires additional conditions such as prototype pollution, and the Vitest advisory has mode/exposure restrictions. This audit did not demonstrate remote code execution in StudyMark. The production-only audit reported zero advisories.

### 05 — The local toolchain uses an end-of-life Node release

**High · Confirmed toolchain gap.** The audit ran on Node 20.19.0. Node 20 is now EOL according to the [official release table](https://nodejs.org/en/about/previous-releases). The README still permits Node 20, and the repository does not pin a supported toolchain through `engines`, a version file, or a package-manager version.

Evidence: [README](../README.md) setup instructions and [package manifest](../package.json).

Remediation: select a supported LTS, record/enforce the supported versions, and verify builds and tests on it. The static browser bundle does not execute inside Node; this concerns build, test and development infrastructure.

### 06 — Clean installations are not reproducible

**High · Confirmed configuration gap.** `package-lock.json` is explicitly ignored and is not tracked. Many dependencies use version ranges, so a new checkout can resolve a different dependency tree from the one audited.

Evidence: [.gitignore](../.gitignore) line 2, [package manifest](../package.json), and an empty `git ls-files package-lock.json` result. [npm documents](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json/) the lockfile's reproducibility role.

Remediation: commit an agreed lockfile and use `npm ci` in CI. The existing ignore rule was preserved during this audit.

### 07 — Filtering and conflict refresh can discard unsaved note edits

**High · Confirmed data-loss defect.** Editing a page note, switching the sidebar filter to Highlights, then returning to All loses the new text. The edit state is owned by an `AnnotationCard` that is unmounted by filtering. A more serious case occurs in My Highlights: if a concurrent update removes the note from the current search result, the version-conflict refresh unmounts the editor. The browser probe found zero editors and zero Retry buttons; reopening showed only the other saved text.

Evidence: [sidebar filtering](../src/features/annotations/NotesSidebar/index.tsx) lines 14–15 and 29, [card edit state](../src/features/annotations/AnnotationCard/index.tsx) lines 11 and 18, [highlight filtering/conflict refresh](../src/features/annotations/HighlightsPage.tsx) lines 26–41; `.qa/reader-audit-results.json`.

Remediation: hold drafts by annotation ID above filtered lists, retain conflicted editors independently of query matches, and make discard explicit. Expand regression coverage to filtering during edits and conflicts under active search.

### 08 — Leaving a page silently discards unsaved drafts

**Medium · Confirmed, documented UX limitation.** Navigation and reload discard unsaved note text. There is no route blocker, unload warning or draft recovery. Sidebar close/reopen retention works, but it does not protect leaving the document.

Evidence: [local note state](../src/features/annotations/NoteEditor/index.tsx) lines 12–15, [reader draft state](../src/features/pdf-reader/PdfReaderPage.tsx) line 26, and the README limitation. No route/unload guard exists in the source.

Remediation: protect dirty forms with an explicit discard decision or session-scoped draft recovery. This does not require implementing offline editing.

### 09 — Reading progress writes can complete out of order

**Medium · Confirmed with delayed transport.** The reader launches debounced progress writes independently. A delayed page-2 write can finish after page 3, overwrite stored progress and update the cache backwards. The probe recorded completion order `[3,2]`, stored page `2`, and reopened page `2` while the user had reached page `3`.

Evidence: [reader progress effect](../src/features/pdf-reader/PdfReaderPage.tsx) lines 61–74; `.qa/reader-audit-results.json`.

Remediation: serialize/coalesce progress writes and use ordering/version semantics across the API. Also decide how to preserve the final page when navigation occurs inside the 350 ms debounce interval.

### 10 — Text contrast fails WCAG AA in several places

**High · Confirmed accessibility defect.** On white, sidebar text `#8a9488` measures 3.15:1, document descriptions `#899189` measure 3.24:1, and note text `#84907c` measures 3.35:1. These are small normal text, below the required 4.5:1.

Evidence: [app styles](../src/app/styles.css) line 53, [library styles](../src/features/shared-library/library.css) line 66, [reader styles](../src/features/pdf-reader/reader.css) line 20. Threshold: [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Remediation: audit and replace text/icon/border tokens across all states, then verify rendered combinations. These examples demonstrate failure; they are not a full inventory of every low-contrast element.

### 11 — The mobile Add note button has no accessible name

**High · Confirmed accessibility defect.** Below 560 px, the only text label is hidden with `display:none`, and the button has no `aria-label`. The browser accessibility snapshot reports an unnamed button containing an image.

Evidence: [PDF toolbar](../src/features/pdf-reader/PdfToolbar/index.tsx), [mobile reader CSS](../src/features/pdf-reader/reader.css) line 26; `.qa/a11y-audit-results.json`.

Remediation: give the button a persistent accessible name or hide the text visually without removing it from the accessibility tree.

### 12 — My Highlights search has no visible keyboard-focus indicator

**Medium · Confirmed accessibility defect.** Its specific `outline:none` overrides the general focus rule; the surrounding label has no focus-within outline or shadow. The probe confirmed keyboard focus with no visible outline/border change.

Evidence: [reader/highlights CSS](../src/features/pdf-reader/reader.css) line 22; `.qa/a11y-audit-results.json`. Reference: [WCAG 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html).

Remediation: restore an input focus indicator or use the library search field's focus-within treatment.

### 13 — Mobile logo navigation leaves the menu open and content inert

**Medium · Confirmed navigation defect.** Open mobile navigation from My Highlights and activate StudyMark home. The URL changes to `/library`, but the drawer remains open and `.app-main` remains inert. Normal navigation links close it; the logo sits outside those click handlers.

Evidence: [AppShell](../src/app/AppShell/index.tsx) lines 38–45; `.qa/a11y-audit-results.json` (`sidebarOpen:true`, `mainInert:true`).

Remediation: close the drawer on route changes, including logo and browser-history navigation, while restoring focus appropriately.

### 14 — SPA routes lack page-specific titles and navigation announcements

**Medium · Accessibility improvement.** The document title remains “StudyMark — Your space to study” on every route. Keyboard navigation to My Highlights leaves focus on the navigation link; there is no route announcement or deliberate content-focus policy.

Evidence: [static title](../index.html), [routes](../src/app/routes/index.tsx), [AppShell](../src/app/AppShell/index.tsx); `.qa/a11y-audit-results.json`.

Remediation: meaningful route/document titles and a tested screen-reader/focus strategy. This observation alone is not presented as a complete WCAG failure determination.

### 15 — Requests cannot be cancelled and have no application timeout

**Medium · Integration.** API methods do not accept an AbortSignal, query functions do not propagate cancellation, and fetch calls have no application deadline. Stalled network operations can leave pending forms disabled and keep obsolete PDF downloads running.

Evidence: [API interface](../src/shared/types/index.ts) lines 84–103 and [HTTP transport](../src/shared/api/http.ts) lines 6–22 and 48–53.

Remediation: cancellation propagation, explicit deadlines, distinct abort/timeout errors and appropriate retry behavior. Do not indiscriminately retry non-idempotent mutations.

### 16 — API response shapes are trusted without runtime validation

**Medium · Integration improvement.** `response.json() as Promise<T>` and casts on error bodies do not validate real payloads. Malformed/mismatched responses can produce undefined data or render errors; PDF responses are accepted as blobs without a content-type contract check. JSON parse/body-download failures also bypass the transport's initial fetch error mapping.

Evidence: [HTTP transport](../src/shared/api/http.ts) lines 18–22, 31–33 and 48–53.

Remediation: validate critical response shapes and invariants at the boundary, handle body parsing failures, and surface actionable protocol errors. TypeScript's compile-time checks do not validate server JSON.

### 17 — Backend pagination cannot be represented by the current client contract

**Medium · Confirmed integration gap.** The adapter accepts a Spring-style `{content}` response but discards totals and page information. Requests contain no page/size values, and the UI paginates only the returned array. Connecting a paginated backend would leave documents after its first page undiscoverable.

Evidence: [HTTP document adapter](../src/shared/api/http.ts) lines 31–33 and 46, [list input](../src/shared/types/index.ts) lines 70–74, [library pagination](../src/features/shared-library/LibraryPage.tsx) lines 25–34.

Remediation: model paged responses and connect page/search/filter state to server queries, including the admin list.

### 18 — Mutation retries have no idempotency or reconciliation contract

**Medium · Integration risk.** Create/upload requests have no client mutation ID or idempotency key. If a real server commits a creation but its response is lost, Retry can create a duplicate. Existing injected-failure tests reject before commit and do not exercise this ambiguous result.

Evidence: [create/upload transport](../src/shared/api/http.ts) lines 55–60 and 68, [annotation input](../src/shared/types/index.ts), [mock failure injection](../src/shared/api/mock.ts).

Remediation: establish server-supported idempotency or reconciliation for creations and test lost responses after commit. Duplicate creation was not claimed to occur under the normal synchronous mock transport.

### 19 — Demo and HTTP modes are not consistently separated

**Medium · Confirmed configuration/UX gap.** Any API-mode value other than exact `http` silently selects the mock. AuthPage always renders demo-account buttons and local-storage claims, even when HTTP mode is selected; Settings and upload/privacy copy also assume a local demo.

Evidence: [API selection](../src/shared/api/index.ts) line 4, [auth page](../src/features/auth/AuthPage.tsx) demo controls/disclaimer, [settings](../src/features/auth/SettingsPage.tsx), [.env.example](../.env.example).

Remediation: validate configuration, explicitly identify the intended deployment mode, and condition demo controls/copy on that mode. A production build may intentionally host a portfolio demo; that should be an explicit choice.

### 20 — Deployment security headers and API routing are not verified

**Medium · Deployment gate.** The Vercel file contains only a catch-all SPA rewrite. It declares no application CSP/frame policy or API proxy. With the default relative `/api/v1` URL, a real API must be provided separately or explicitly routed. No deployed URL/header configuration was supplied or inspected, so external dashboard configuration cannot be ruled out.

Evidence: [Vercel configuration](../vercel.json), [environment example](../.env.example), [HTML](../index.html).

Remediation: configure and verify API routing, HTTPS/cookie/CORS behavior and suitable headers (including CSP/frame restrictions), accounting for PDF workers, local assets and optional Google Fonts. Add deployed smoke checks rather than assuming local Vite behavior proves release readiness.

### 21 — Quality checks are not enforced by repository CI

**Medium · Confirmed automation gap.** Commands exist, but there is no checked-in CI workflow requiring typecheck, lint, unit tests, browser tests or dependency review. `build` runs TypeScript/Vite only. Remote branch protection and external CI settings were not available to this audit.

Evidence: repository file inventory and [package scripts](../package.json).

Remediation: add repeatable CI and required checks, with separate production dependency and developer-tool advisory review. Tie builds to a committed lockfile and supported runtime.

### 22 — Test coverage is narrower than the production claim

**Medium · Confirmed verification gap.** The existing 40 tests and seven browser workflows pass, yet the additional probes found defects. The browser config runs one Chromium-family channel; there is no Firefox/WebKit matrix, automated accessibility scan, screen-reader verification, HTTP adapter contract suite or production-build browser smoke configuration. Coverage reporting/thresholds are absent. Current error injection does not simulate network timing and post-commit response loss.

Evidence: [Playwright configuration](../playwright.config.ts), [Vitest configuration](../vite.config.ts), [test suite](../e2e/studymark.spec.ts), repository test inventory.

Remediation: prioritize tests for the confirmed failures, then add the supported-browser matrix, keyboard/screen-reader review, HTTP contract/error tests and a built-artifact smoke test. Coverage percentage alone is not the goal.

### 23 — PDF and annotation workloads lack resource budgets and scale verification

**Medium · Confirmed design gap; production impact unmeasured.** PDFs are fetched as complete blobs, copied into ArrayBuffers, and passed to PDF.js as data, so the reader cannot take advantage of range-based loading. Canvas dimensions have no total pixel budget; limiting DPR alone does not bound memory for unusually tall pages or higher zoom. My Highlights loads and renders the entire annotation collection. There are no large-document/library benchmarks or deployed performance measurements.

Evidence: [PDF content fetch](../src/shared/api/http.ts) lines 48–53, [viewport](../src/features/pdf-reader/PdfViewport/index.tsx) lines 40–44 and 62–67, [all highlights](../src/features/annotations/HighlightsPage.tsx) lines 19 and 56–58.

Remediation: measured limits, bounded canvas allocation, streaming/range loading where appropriate, pagination/virtualization when justified by data volume, and representative stress measurements. No crash or latency threshold is asserted without a measurement.

### 24 — Error diagnostics and operational observability are incomplete

**Medium · Confirmed plan gap.** The error boundary offers reload but does not report exceptions. HTTP errors discard request IDs, and there is no request latency/status instrumentation, upload failure counter or annotation-save failure counter. The plan explicitly called for observability without logging note contents.

Evidence: [ErrorBoundary](../src/shared/ui/ErrorBoundary.tsx) lines 5–12, [ApiError](../src/shared/api/errors.ts) lines 1–9, [HTTP error parsing](../src/shared/api/http.ts) lines 17–19.

Remediation: privacy-aware error reporting, request correlation and relevant metrics, with explicit exclusion/redaction of note text, PDF contents and credentials.

### 25 — Source formatting and design consistency need maintenance safeguards

**Low · Improvement.** Several components contain dense one-line JSX; entire CSS sections occupy a single line, with many repeated hardcoded colors and spacing values. There is no formatter configuration or accessibility lint plugin. The ESLint setup is not type-aware, so it does not provide checks such as no-floating-promises.

Evidence: [AppShell](../src/app/AppShell/index.tsx), [admin page](../src/features/admin/AdminPage.tsx), [reader CSS](../src/features/pdf-reader/reader.css), [ESLint config](../eslint.config.js), [package manifest](../package.json).

Remediation: adopt readable formatting, use shared tokens where they improve consistency, and add targeted lint rules. These are maintainability recommendations, not evidence that a particular architecture or formatter is mandatory across the industry.

## Recommended order

Scheduling decision, 10 November 2026: the user will create the backend themselves. Remediation of all findings is deferred until they confirm it is ready. Follow the [post-backend plan](POST_BACKEND_PLAN.md) for the handoff and execution sequence; the technical priorities below remain the original audit recommendation.

1. Fix reproduced data loss, progress ordering, inaccessible controls/contrast, and the mobile menu defect.
2. Establish supported/reproducible tooling and address development dependency advisories; enforce checks in CI.
3. Complete and test the HTTP session, CSRF, response, pagination, cancellation and retry contracts while building the planned backend.
4. Verify deployment security, accessibility, operational diagnostics and performance before accepting real private documents or claiming production readiness.

The existing strengths are worth keeping: strict TypeScript, feature boundaries, a replaceable API interface, lazy reader loading, normalized multi-rectangle anchors, transaction-based mock persistence, version-conflict handling, and meaningful browser workflows. The audit findings show where those foundations still need work.
