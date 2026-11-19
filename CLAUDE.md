# DocuMind — guidance for Claude Code

Next.js 16 (App Router) + TypeScript + Tailwind v4 + Drizzle/PostgreSQL(pgvector) + Clerk. Modular monolith. No sample or placeholder data anywhere.

## Commands
- `npm run dev` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run e2e`
- DB: `npm run db:setup` (enables pgvector, pushes schema). Optional retry worker: `npm run worker`.

## Architecture rules
- `lib/` holds domain logic; route handlers and Server Actions are thin adapters.
- Every route: `getTenant()` → `requirePermission()` → zod-parse input → call `lib/`. Wrap with `handle()`.
- Every query that touches tenant data must filter by the caller's organization in SQL (`ensureWorkspace(t).orgId`). Never look up a row by id alone.
- Authorization happens in SQL *before* retrieval results can reach a model (`lib/retrieval.ts`).
- Citations are built server-side from retrieved chunks only (`lib/citations.ts`). Never trust model-supplied ids or pages.
- Document versions are immutable; chunks reference a version; embeddings record the model id.
- Treat document text as untrusted data (prompt injection). Never log raw document content.
- Ingestion lives in `lib/ingest.ts` and runs inline after upload (`after()`); the worker and cron route reuse it.
- Route files may only export HTTP handlers and route config (`maxDuration`, `dynamic`). Put shared constants in `lib/`.
- Empty states are first-class: a new account has no data, so every screen must explain what belongs there and offer the next step.
- Next 16: `proxy.ts` replaces `middleware.ts`; `params` and `searchParams` are Promises.

## Style
Server Components by default; `"use client"` only for interactivity. Use existing UI primitives in `components/ui`. Use theme tokens (`bg-panel`, `border-line`, `text-dim`, `text-brand`), not hard-coded hex. Add tests in `tests/unit` for logic in `lib/`.

## Review cockpit and Docs
- Dashboard + `/documents/[id]` render `components/review/cockpit.tsx` from `lib/review-center.ts` (`getCockpit`). Validation checks and anomaly detection are pure functions in `lib/validation.ts`; nothing is hard-coded.
- Review decisions (approve, send to review, notes, export) are written to `audit_logs` with `resource_type = 'document'`; the timeline reads them back.
- Docs (`/docs`) are editable rich-text documents in `editor_documents` / `editor_shares`. Access is decided only by `lib/docs-access.ts` (owner, editor, viewer). Callers without access get 404. Content is sanitized HTML (`lib/docs-html.ts`) and saves use a revision compare-and-swap.

## Git workflow
- Commit after every logical change, never batch unrelated work. Use Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`.
- Run `npm run typecheck` and `npm test` before committing. Never commit `.env.local` or any key.
