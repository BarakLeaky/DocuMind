# DocuMind

Upload documents, ask questions in plain language, and get answers that cite the exact passage.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · Clerk (accounts) · PostgreSQL + pgvector (Neon) · Drizzle ORM ·
Claude (answers and field extraction) · optional OpenAI embeddings · Vitest · Playwright

There is no sample data. A new account starts with an empty workspace; everything you see comes from files you upload.

## What it does

- **Accounts:** sign up and sign in with Clerk. Each account gets a private workspace on first sign-in.
- **Upload:** PDF (with selectable text), Word (.docx) and text files. File type is checked from the file contents, not its name.
- **Processing:** text is extracted, split into passages, indexed for keyword search and (optionally) embedded for meaning-based search.
- **AI console:** answers come only from your documents and carry citations the server checks against the passages it retrieved.
- **Review:** with an Anthropic key, key fields (dates, parties, totals…) are extracted with a confidence score for you to approve or reject.
- **Governance:** role permission matrix, members and an audit log of uploads, downloads, deletions, reviews and questions.

## Run it on your computer

You need Node 22+, a free [Clerk](https://dashboard.clerk.com) app and a free [Neon](https://neon.com) database.

```powershell
copy .env.example .env.local     # then fill in the values below
npm install
npm run db:setup                 # enables pgvector and creates the tables
npm run dev                      # http://localhost:3000
```

Fill these in `.env.local`:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk dashboard → your app → API keys |
| `DATABASE_URL` | Neon console → your project → Connection details (copy the connection string) |
| `STORAGE_SIGNING_SECRET` | Any long random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ANTHROPIC_API_KEY` *(optional)* | console.anthropic.com. Enables generated answers and field extraction |
| `OPENAI_API_KEY` *(optional)* | platform.openai.com. Enables meaning-based search |

Without the optional keys the app still works: search is keyword-only, the console quotes the closest passages, and fields are not extracted.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project**, import the repo.
3. Add every variable from `.env.example` that you filled in locally (Settings → Environment Variables), plus `CRON_SECRET` (any random string).
4. Deploy. The database is already set up from `npm run db:setup`, since local and production can share one Neon database or use separate ones (run `npm run db:setup` against each).
5. In Clerk, add your Vercel domain under Domains, and for production create a production instance and swap in its keys.

### Known limits

- **File size:** 4 MB per file by default, because Vercel functions accept request bodies up to 4.5 MB. Files are stored in Postgres. For larger files, implement `DocumentStorage` in `lib/storage.ts` with S3, R2 or Vercel Blob.
- **Scanned PDFs** (images of pages) are rejected with a clear message; OCR isn't built yet.
- Spreadsheets (.xlsx) and presentations aren't supported yet.
- Answers arrive all at once rather than streaming.
- Teams: sign-ups get a personal workspace. To share a workspace, enable Organizations in Clerk; members map to roles in `lib/rbac.ts`.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Unit tests | `npm test` |
| Types / lint | `npm run typecheck` · `npm run lint` |
| Browser smoke tests | `npx playwright install chromium`, then `npm run e2e` |
| Create/update tables | `npm run db:setup` |
| Inspect the database | `npm run db:studio` |
| Background worker (optional) | `npm run worker` |

## Where things live

```
app/(app)/…        dashboard, library, document review, search, AI console, governance
app/api/v1/…       REST API: upload-intents, uploads, documents, search, assistant
app/api/cron/…     retry endpoint for stuck jobs (needs CRON_SECRET)
lib/               domain logic: rbac, data queries, retrieval (hybrid + RRF), citations, chunking, ingest, storage, ai/
db/schema.ts       Drizzle schema
proxy.ts           Clerk route protection (Next.js 16 renamed middleware.ts to proxy.ts)
```

## Security notes

- Every query is scoped to the caller's workspace in SQL; retrieval filters by access before any text reaches the model.
- Document text is treated as untrusted input to the model; citations are rebuilt server-side from retrieved passages only.
- Uploads use short-lived signed links bound to the uploader's workspace. Original files download only for roles with `document.download`.
- Secrets live in environment variables. `.env.local` is git-ignored; never commit it.


## Review cockpit and Docs

**Dashboard review cockpit.** The newest document with extracted fields appears on the dashboard with per-field confidence, validation checks, anomaly detection, an activity timeline, review notes, *Send to Review* and *Approve & Export* (JSON or CSV). Everything is read from the database; processing documents refresh automatically.

**Docs.** `/docs` lists "My documents" and "Shared with me". Create, rename, edit (bold, italic, underline, H1/H2, lists) with autosave, import `.txt`, `.md`, `.docx` (up to 2 MB), and share by email as view-only or can-edit. The person you share with needs an account in this app. Only the owner can share or delete.

After pulling these changes run `npm install` and `npm run db:push` (adds `editor_documents` and `editor_shares`).
