# Horizon Strings dashboard

- This repository is the private dashboard only; never change the sibling public website as part of dashboard work.
- Current implementation/setup references: README and docs/architecture.md, workflow.md, deployment.md, decision-log.md. Files under legacy-reference are superseded.
- Use synthetic data for tests. No live spreadsheet migration or credentials in source.
- All live data access must preserve Supabase Auth, owner allowlisting and RLS. No service-role key is needed.
- Use atomic, revision-checked event saves. Run npm run check and npm run build before release.
- The owner requested autonomous completion of minor details and a single final nested Markdown checklist, with no interim review questions. Preserve material unapproved choices in that checklist.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
