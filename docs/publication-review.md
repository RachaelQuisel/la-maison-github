# Publication review: November 2, 2026

This records the initial edition. See the later [source recovery review](source-recovery-2026-11-02.md) for the recovered assignment and inspection implementations and the remaining provider-configuration gaps.

This is a new public edition, with a new Git history. Complete private operating repositories, their configuration, records, decisions and original history are retained separately. A private companion maps each public feature to its known full source and records implementation gaps.

## What was reviewed

- Booking sync: 10 local cases covering disabled execution, supported booking messages, dates across years, cancellations, incomplete stays, idempotency and preservation of manual event notes.
- Cleaning coverage: all 81 inherited decision cases pass with sample identities, plus a check that disabled execution makes no external calls.
- Monthly reporting: 10 Python tests cover separate revenue bases, deductions, penalties, dated delivery deadlines, invalid inputs, required identity, the official form contract, output readback, readable amount appearances, a blank signature and overwrite protection.
- The generated example PDF was visually reviewed on both filled pages. No real property or filer data was used.

These are local checks with service doubles and a downloaded public blank form. No messages were sent, live calendars changed, payment made or production integration certified by these checks.

## Privacy boundary

Candidate files were compared against the private source values selected for adaptation, then scanned for credentials and common personal or operational identifiers. The review found no retained private values or secrets. Configurations use nonworking examples and disabled defaults; identity files, generated PDFs and downloaded form templates are excluded from Git.

Only the reviewed source, runbooks, examples and tests are published. Original private histories, contact rosters, guest messages, accounting exports, completed forms, access-code rules and operational evidence are not imported. The private companion records the source snapshots without duplicating sensitive records.

## Scope and limits

Five portfolio features now have source-backed process documentation, including links to the existing public plugin and Airtable repositories. Four other features have workflow designs and explicit implementation gaps. A storyboard is not evidence that its backend is complete or running.

The booking, coverage and reporting code has been adapted for public review; [the differences are documented](public-private-editions.md). The current reporting form and deadline table are dated inputs. A changed form or an unsupported reporting period requires review before use. Supporting source links are in [the reporting runbook](../workflows/monthly-reporting/README.md).
