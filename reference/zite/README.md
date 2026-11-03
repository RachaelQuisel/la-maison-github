# Zite source excerpts

These files are adapted from the recovered application source reviewed November 2, 2026. The full application, UI, dependency locks, generated Airtable field bindings and exact source manifest are retained in the private edition. This folder contains the business endpoints and shared inspection/repair helpers, rather than an exported working account.

## Publication changes

- Removed the operating SMS sender, property email and Slack channel identifiers; placeholders cannot reach a real destination.
- Added an unconditional stop at every endpoint entry point. These files are reference material and cannot perform live operations as published. The private original is preserved without that stop.
- Omitted the live app address, personal staff links, integration connection IDs, database/table/field bindings, credentials and records.

The decision logic after the publication stop is retained from the reviewed source. Imports refer to Zite's `zitejs` runtime, its generated Airtable clients, `zod` and `googleapis`; this is not a standalone installable app. The private manifest records the complete application source snapshot and dependencies.

Read the [cleaner assignment process](../../workflows/cleaner-signups/README.md) and [inspection follow-up process](../../workflows/inspection-follow-up/README.md). Reuse requires an appropriate identity model, permissions, conflict handling, provider configuration and testing in a separate private project. No production setting was changed to publish these excerpts.
