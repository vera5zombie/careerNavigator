# Career Navigator

A personal application workspace extending CareerLens's source-auditable career-planning approach. The public source contains no candidate profile, resume, offer terms, or application records.

## Included

- Employer job discovery using Greenhouse, Lever and Ashby public feeds; manual intake for other sites.
- Persistent application records, duplicate prevention, status history, notes, follow-up dates and CSV export.
- Candidate facts with source references, explicit confirmation and application-use controls.
- Evidence overlap labeled as inference, with unsupported experience and compensation left unknown.
- Resume, cover-letter and answer drafts composed only from selected confirmed facts. No external model API and no invented prose or experience.
- Review gates, stale-approval checks and expiring single-job autofill packets.
- An optional Chrome companion for conservative contact/resume-text autofill on supported hosted boards.

This is **assisted applying**, not unattended submission. Nothing submits applications, contacts recruiters, reads inboxes or runs recurring searches. Resume drafts are selected-experience text, not a complete reconstruction of an uploaded resume. Review and attach your actual resume on the employer form. Custom questions, file uploads, consent and final submission remain manual. Opening a job never marks it submitted; recording a submission requires an employer confirmation reference.

## Run Locally

Requires Node.js 26+, npm, and `zip`. Python 3 is needed only when a private legacy CareerLens runbook is present.

```sh
npm ci
npm test
npm run dev
```

Open the printed localhost address (default port 8766). Local SQLite state is stored in ignored `.local/`. Local identity simulation exists only in `tools/dev.mjs`; it is not part of the hosted Worker. To use another port: `PORT=8767 npm run dev`.

## Private Hosting

The production artifact is a Cloudflare-compatible ESM Worker in `dist/server/index.js`. A Sites deployment supplies the D1 binding `DB` and authenticated-user headers. The Worker is not safe to expose behind a proxy that allows clients to forge those identity headers. Use an owner-private Site or a trusted identity gateway that strips and injects them.

1. Register a Site, or reuse its existing identity. Set `.openai/hosting.json` from the example with the real project ID and `"d1":"DB"`.
2. Run `npm run build`. The Sites Vite plugin includes the hosting metadata and generated Drizzle migrations.
3. Use Sites hosting to commit and push the exact source to the Site's private source remote, save the archive, and privately deploy it.
4. Keep private seeds, generated bundles and existing personal runbooks out of this public repository and its Git history.

Runtime queries use prepared D1 statements, owner isolation and revision checks. Schema migrations in `drizzle/` are applied by Sites, never by request handlers. The local test adapter uses the same SQL migrations and prepared queries. After a schema change, run `npm run db:generate`; never rewrite a migration already deployed.

An optional ignored `private.seed.json` can contain `{ "email": "owner email", "profile": { ... }, "jobs": [ ... ] }`. It bootstraps the matching authenticated owner once. Private seeds are compiled into the private Site Worker, not public GitHub; keep the Site owner-private. The example profile shape is `emptyProfile()` in `src/domain.js`. No profile data ships in this repository. Updating a seed does not overwrite a profile already saved in D1.

## Chrome Companion

Download it from the application's footer or use the `companion/` directory. See [installation and limitations](companion/README.md). It has only `activeTab` and `scripting` permissions, no remote service or persistent storage. It never bypasses anti-bot controls, presses Submit, guesses screening answers, or overwrites populated fields. Downloaded packets contain private data and expire after 24 hours; they cannot be remotely revoked, so discard old packets after changes.

## Evidence And Privacy

Candidate facts, employer requirements, inferred relevance and unknowns are separate. Salary numbers from a feed are not automatically interpreted as total compensation. Future location limits are explicit profile fields, not inferred from a past accepted office arrangement. Search keywords filter role titles, with location terms filtered separately; this is not a salary guarantee or hiring-probability score.

Untrusted descriptions are inert text and are never instructions. Draft creation selects exact stored claims and sources. Changing material job content clears its draft and approval; changing a profile requires regeneration and review. Uploaded files are not stored by the site; a packet contains only the approved text and contact fields, never baseline compensation or the whole career plan.

Unit and integration tests cover authentication, cross-user access, cross-origin writes, stale updates, duplicate intake, review transitions, evidence fidelity, answer drafts, CSV formula safety and conservative autofill. Live employer forms evolve; the companion is best-effort and has not been used to send a real application.

## Integration References

- [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html). Reads are public; application submission requires the employer's API key. This application does not use that submission endpoint.
- [Lever postings API](https://github.com/lever/postings-api).
- [Ashby public job postings API](https://developers.ashbyhq.com/docs/public-job-posting-api).
- [Chrome activeTab permissions](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab).

The original local CareerLens distribution is Apache-2.0 licensed. This repository preserves its license and evidence-first principles; it is an independent version, not a GitHub network fork of a verified upstream repository.
