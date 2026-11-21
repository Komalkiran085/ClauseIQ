# ClauseIQ — AI Document Review

Clause is a document review workspace for the supplied Northwind Analytics / Brightline master services agreement. Reviewers can inspect risks alongside the contract, record decisions and comments, apply verified replacements, and export their review.

The assessment's original **24 findings** are available immediately. Optional Gemini integration generates fresh findings, drafts replacement wording, and answers questions about a selected finding. An API key is only needed for these optional features.

## Quick start with Docker — macOS and Windows

Install and start Docker Desktop. On Windows, use Linux containers and complete Docker Desktop's WSL setup if requested.

Open a terminal or PowerShell in the project folder:

```sh
docker compose up --build -d
```

Open [http://localhost:8080](http://localhost:8080).

Docker installs dependencies and builds the app inside its containers. No host Node.js installation is required. Both services start without a Gemini key; sample review remains available.

```sh
# Stop the project
docker compose down

# Start existing containers again
docker compose up -d

# Rebuild after changing code or Gemini configuration
docker compose up --build -d

# Inspect service logs
docker compose logs --tail=100
```

Port 8080 must be available. To change it, add `PORT=8081` to `.env`, recreate the services, and open the new port. The configuration uses multi-platform base images and avoids host-specific mounts.

## Local development

Use Node.js 24 or newer:

```sh
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The launcher starts both Vite and the Node API; Ctrl+C stops them. The API listens on port 3001 and Vite proxies `/api` requests to it.

`npm run build` checks TypeScript and produces the frontend in `dist`. `npm run preview` previews those static files; it does not start the API or proxy Gemini requests. Use the development launcher or Docker for the complete app.

## Optional Gemini setup

Create a `.env` file from `.env.example`:

```sh
# macOS
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

Fill in your Google AI Studio API key:

```dotenv
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3.1-flash-lite
```

Restart local development, or recreate Docker services using the build command above. The model can be changed to one available to your API project. Gemini API access and quota are separate from access to the consumer Gemini chat app.

The key is used only by the backend. `.env` is excluded from Git and the Docker build context. Do not put it in frontend code, use a `VITE_` prefix, or share it with the submission. Requests use HTTPS; local development also uses the operating system's trusted certificates.

## Review workflow

1. **Identify the source.** The source banner shows Assessment sample or Gemini analysis. Both source buttons stay visible; the active source button is disabled.
2. **Choose a finding.** The document scrolls to its referenced paragraph. Finding markers beneath paragraphs navigate back to the corresponding details, including overlapping findings.
3. **Read the evidence.** Details include severity, category, explanation, confidence, source quote, and proposed wording where available.
4. **Record a decision.** Accept or dismiss the finding; reopen it to change your decision. Accept becomes light green after selection. Add a reviewer note for context. A comment alone does not complete a finding.
5. **Apply wording separately.** Apply suggested edit replaces a verified passage in the working document. Changes appear in green. Undo restores the original text. Acceptance records agreement with the finding and does not apply its replacement.
6. **Export.** Export review downloads JSON containing findings, their source agent, decisions, notes, anchor diagnostics, applied edit IDs, the revised structured document, and completion counts. Word and PDF export are not implemented.

Search and combine severity, status, and category filters. Progress counts findings with explicit accept/dismiss decisions. Completion of review does not mean every suggested edit was applied.

Keyboard shortcuts outside form controls: **J/K** next/previous finding, **A** accept, **D** dismiss, **C** focus the reviewer note. Mobile layouts use Findings, Document, and Detail tabs.

### Switching sources

- **Analyze with Gemini** sends the original agreement to Google and requests fresh risks, severity levels, explanations, confidence, references, and proposed corrections. A loading indicator appears while analysis runs. Results replace the current review only after successful validation; errors preserve the current review.
- **Assessment sample** restores the original 24 supplied findings.
- Both actions show a centered confirmation dialog explaining that switching clears the current decisions, comments, and applied edits. Cancel or Escape leaves the review intact. Export first if you want to keep a copy.

The current findings, source, decisions, notes, and applied edits save in browser local storage. Refresh restores them rather than making another AI request. There is no database, cross-device sync, or import-from-export feature. Browser data can be cleared or unavailable; export important reviews. Different browsers and origins, including ports 5173 and 8080, have separate saved state.

### Gemini questions and replacement drafting

**Ask Gemini about this finding** sends the original agreement, selected finding, and question to Gemini. Questions are independent requests rather than a persistent conversation. Responses do not change the document or review decisions. Reviewer comments and working-copy edits are not included in this context.

If a finding has no proposed wording, **Generate replacement with Gemini** requests it. AI output is untrusted: structured results are validated and passage locations checked before automatic replacement is allowed. Review the substance of every suggestion; matching a passage does not establish legal correctness.

A missing clause has no existing text to replace. Its proposed wording is shown for manual insertion and automatic Apply remains disabled. Automatic insertion of new clauses is not implemented.

## Architecture and decisions

- **React and TypeScript:** custom findings queue, document viewer, details panel, filters, review actions, source dialog, and Gemini panel.
- **Custom CSS and annotation logic:** no off-the-shelf annotation engine or UI component kit. Lucide supplies icons.
- **Immutable original document:** the working copy is derived from original text plus applied edit IDs, so offsets do not drift after edits.
- **Safe anchoring:** verify supplied offsets against quotes; recover a unique exact quote inside its referenced paragraph range when offsets differ. Unverified spans are flagged and cannot be replaced automatically.
- **Overlapping annotations:** split text into segments without duplicating content. Paragraph markers provide explicit navigation when several findings share text.
- **Conflicting replacements:** overlapping edits cannot be applied together. Undo the earlier edit before applying the alternative. Cross-paragraph source spans are supported. In changed paragraphs, other findings remain accessible through paragraph markers even when original inline highlights are no longer displayed.
- **Node backend:** proxies Gemini requests and keeps the key private. Review data remains in browser storage. `/api/health` reports configuration, `/api/analyze` generates findings, `/api/suggest` drafts wording, and `/api/ask` handles questions.
- **Docker:** a Node API container and an unprivileged Nginx frontend container. Nginx proxies API requests. Compose exposes the frontend on localhost and keeps the API inside the container network.

The three-panel layout was chosen to keep the review queue, evidence, and explanation together. A static JSON-only implementation would meet the core assessment; the small backend enables optional live AI without exposing credentials. Server-side review storage was deferred because the exercise explicitly allows local state.

## Priorities, scope, and future work

Prioritized contextual review, reliable anchors, clear decision states, persistence, filters, responsive presentation, reversible text replacements, and portable setup. Gemini was added as an optional enhancement beyond the supplied findings.

Not implemented: arbitrary document upload, authentication, shared review sessions, free-form document editing, automated clause insertion, and Word/PDF exports.

With more time, prioritize readable document/report exports, manual anchor correction, original/revised comparison, a safe insertion-location picker for missing provisions, separate saved reviews per source, import/restore, and broader accessibility testing. Multi-user deployment would additionally need authenticated storage, audit history, and conflict handling.

## Tests

```sh
npm run build
npm test
npm run test:api
npx playwright install chromium
npm run test:e2e
```

- **11 unit tests:** quote recovery, invalid anchors, multi-paragraph references, overlapping annotations, saved decisions, working-copy replacements, and conflicts.
- **7 API tests:** missing credentials, request validation, origin checks, provider requests, analysis normalization, and replacement generation.
- **4 browser tests:** review decisions, comments, filters, mobile layout, applying/undoing edits, fresh findings, replacement generation, source switching, centered confirmation dialogs, cancellation, persistence, and export downloads.

Automated Gemini tests use mocked responses and do not require a key. Live analysis and replacement generation have also been checked manually with a configured model. Model availability and quota can change.

For an installed Google Chrome instead of Playwright's downloaded Chromium:

```sh
# macOS
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

```powershell
# Windows PowerShell
$env:PLAYWRIGHT_CHANNEL="chrome"
npm run test:e2e
```

## Deployment scope

Containers run without root, with read-only filesystems, dropped capabilities, and no privilege escalation. Nginx sets restrictive response headers and has a frontend health check. The API limits request size, request frequency, concurrent requests, and provider timeouts; errors avoid returning credentials or raw provider details.

This setup is intended for local assessment/demo use. For public deployment, add HTTPS, authentication, durable per-user quotas, and monitoring. The current rate cap is in memory. The bundled contract and sample findings are readable by anyone who can load the app. Gemini actions send contract context to Google; sample review does not require external AI calls.
