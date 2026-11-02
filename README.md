# La Maison Github

Process documentation and reviewed reference code from Rachael Quisel’s vacation-rental automation work.

These projects grew out of running La Maison in Santa Barbara. The goal here is to make the work behind the videos understandable: what starts each workflow, which information it needs, what decisions it makes, what it produces, and how to test it.

## Explore the projects

| Project | Process and source | What is available |
|---|---|---|
| Airbnb Hosting Expert | [Instructions and package](https://github.com/RachaelQuisel/airbnb-hosting-expert), [listing-review example](https://github.com/RachaelQuisel/airbnb-hosting-expert/blob/main/examples/la-maison-listing-review.md) | Public plugin source; current package 2.3.0 |
| Booking sync to a shared calendar | [Runbook](workflows/booking-sync/README.md), [Apps Script](workflows/booking-sync/Code.gs) | Reviewed public code edition, setup, and local tests |
| Cleaning coverage automation | [Runbook](workflows/cleaning-coverage/README.md), [Apps Script](workflows/cleaning-coverage/Code.gs) | Reviewed public code edition, cascade rules, and 81 inherited test cases |
| Monthly reporting and PDF preparation | [Runbook](workflows/monthly-reporting/README.md), [PDF preparation code](workflows/monthly-reporting/fill_tot_form.py) | Independent tax-base calculations, field mapping, blank-form validation, and tests |
| Property Inspector Checkoff List | [Source and adaptation notes](workflows/property-inspector-checkoff-list.md), [Airtable source](https://github.com/RachaelQuisel/Airtable-AI-Webinar) | The underlying four-version Airtable interface case study, source, field map, and prompts |
| Scheduling cleaners by text | [Workflow design](workflows/designs/cleaner-signups.md) | Process design; the exact claim-form backend is not included |
| Guest door codes | [Workflow design](workflows/designs/guest-door-codes.md) | Lifecycle and control points; no property access details or lock connector |
| Property inspection follow-up | [Workflow design](workflows/designs/inspection-follow-up.md) | Inspector-to-contractor process; dispatch backend is not included |
| Ops Today daily briefing | [Workflow design](workflows/designs/ops-today.md) | Inputs, assembly, delivery, and recovery design; briefing connector is not included |

The first five have source-backed process documentation. The remaining four are documented designs. This publication does not turn an animation or a written design into a verified live integration.

[See the portfolio videos](https://airbnbai.rent/automate.html) · [More work on GitHub](https://github.com/RachaelQuisel)

## Run the local checks

The Apps Script tests use Node’s built-in VM and service doubles. They do not connect to Google, send messages, or change calendars.

```sh
node tests/run-workflows.mjs
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python scripts/fetch-city-template.py
.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v
```

Node 24 and Python 3.12+ are the reviewed runtimes. Python dependencies are pinned in `requirements.txt`. The template-fetch step downloads the City’s public blank form and verifies its checksum and fields. A changed form is rejected until reviewed.

## Public and private editions

This repository is a separate public edition. Complete operational repositories and their history remain private. Real staff contacts, guest records, reservation IDs, calendar and Airtable identifiers, accounting exports, completed tax forms, credentials, access-code rules, and operational screenshots are excluded.

Public examples use `example.invalid` addresses and reserved example phone numbers. Both Apps Script entry points ship disabled. The reporting tool requires an explicitly supplied local identity file; generated PDFs are ignored by Git.

See [privacy and release boundaries](PRIVACY.md), [publication review](docs/publication-review.md), and [how updates are promoted](docs/public-private-editions.md).

## Authorship and reuse

The automation work and this public adaptation are by Rachael Quisel. The existing Airtable and plugin repositories retain their own notices and licensing. This repository is public for review; it does not grant permission to use third-party trademarks or override the [copyright notice](LICENSE).
