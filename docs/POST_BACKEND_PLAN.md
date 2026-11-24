# StudyMark follow-up after backend completion

Recorded: 10 November 2026.

## Status and ownership

**Deferred until the user completes the backend and confirms it is ready for integration.** The user will create the backend themselves. Audit remediation starts after that handoff, including frontend-only fixes. No completion date has been set; this is a project milestone, not an automatic reminder or background task.

The [engineering audit](ENGINEERING_AUDIT.md) remains the source of evidence for all 25 open findings. This plan does not mark any finding resolved. Backend creation alone does not close a finding without verification.

## Backend handoff

When the backend is ready, provide its repository or local path, startup instructions, development API URL, and API documentation or OpenAPI schema. Use [API.md](API.md) as the existing frontend contract and identify any differences.

The integration handoff should cover:

- Test student/admin accounts and representative documents, without sharing production credentials.
- Session cookies, expiry/logout behavior, CORS and CSRF conventions.
- Ownership/publication rules, protected PDF delivery and upload constraints.
- Pagination, error responses, annotation version conflicts, progress ordering and retry/idempotency behavior.
- Database migrations, file storage configuration and a safe test environment.

Resolve missing contract details during integration rather than assuming the current HTTP adapter already supports them.

## Remediation sequence after handoff

| Order | Work | Audit findings | Completion evidence |
| --- | --- | --- | --- |
| 1 | Recheck the audit against the completed backend; verify authentication, authorization, private storage and durability. Record remaining backend work for the user. | 01 | Backend behavior and contract review with account-isolation and access-revocation checks. |
| 2 | Protect unsaved drafts and reading progress; fix contrast, accessible control names, keyboard focus, mobile menu navigation and route announcements. | 07, 08, 09, 10, 11, 12, 13, 14 | Regression checks for the reproduced failures, keyboard/mobile review and measured contrast. |
| 3 | Update supported tooling, resolve dependency advisories, commit reproducible dependency metadata and enforce quality checks in CI. | 04, 05, 06, 21 | Clean reproducible install, reviewed dependency audit and passing CI checks. |
| 4 | Integrate and harden HTTP session handling, CSRF, cancellation/timeouts, response validation, pagination, safe retries and environment-specific UI. Coordinate required backend changes with the user. | 02, 03, 15, 16, 17, 18, 19 | Real API contract and failure-path tests, including session switching, expiry, stale versions and lost responses after commit. |
| 5 | Verify deployment configuration, supported browsers, accessibility, PDF/resource limits and privacy-aware diagnostics; improve source consistency. | 20, 22, 23, 24, 25 | Production-build smoke checks, accessibility/browser results, representative performance measurements and redacted diagnostic evidence. |

Each finding stays open until its acceptance evidence is recorded in the audit. Add regression coverage alongside each fix; the final phase expands validation across the integrated application. Recheck dependency advisories and runtime support at implementation time because the audit is a dated snapshot.

## Resume instruction

When the user says the backend is ready, resume from this plan, inspect the supplied backend contract and current repository state, and work through the open findings in order. Record any work that requires backend changes for the user; do not infer ownership of backend implementation from this plan.
