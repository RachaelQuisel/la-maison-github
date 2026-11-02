# Monthly reporting and PDF preparation

## The process

Source collection → cash reconciliation → independent taxable components → calculation → form mapping → reopen/readback → owner review.

Collect the reporting month, source statements, booking charges, refunds, bank postings, and supporting exemption/adjustment records privately. Separate bank deposits from room revenue, fees, collected tax, and refunds. Resolve source disagreements rather than adding a balancing adjustment. Confirm the reporting basis against current City instructions; a bank date and a stay date are different facts.

TOT and TBID use separate bases. The public calculator accepts the independently reviewed figures; it does not infer those figures from bank receipts or download any account data. The City’s [official instructions and current form](https://santabarbaraca.gov/business/business-taxes-assessments/transient-occupancy-tax) were checked on November 2, 2026. The reviewed model uses 12% for the TOT base and 2% for the room-only TBID base.

## What is included

- `compute_lines`: Decimal arithmetic, separate bases/deductions, rounding, penalties, and adjustments.
- `build_field_values`: semantic mapping to the 25-field City form, leaving the signature blank.
- `fill_pdf`: checksum/field-contract validation, refusal to overwrite by default, temporary output, full field readback, then final save.
- `due_dates.py`: the reviewed dated deadline table; unsupported periods fail rather than invent a date.
- An explicit local identity file for account, business, location, filer, email, and phone. No real identity ships in code.

The current City fillable PDF has different bytes from the older private template. This public edition was checked against the current five-page form and locked to SHA-256 `b9543fd47a24e440f570773fe96159990d8c140dff7b6bbfed8b9afafbf008b8`. The field names remain the reviewed 25-field contract. Printed line numbering has inconsistencies; the calculation maps semantic fields and adds TOT plus TBID.

## Run an example

From the repository root:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python scripts/fetch-city-template.py
.venv/bin/python workflows/monthly-reporting/fill_tot_form.py \
  --identity workflows/monthly-reporting/identity.example.json \
  --month 10 --year 2026 --line1 1200 --line5 1000 \
  --filing-date 2026-11-01 --delivery-method city-hall --slug example
.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v
```

The example produces $144 TOT plus $20 TBID, or $164, in an unsigned sample PDF. Those amounts and identity values are examples, not La Maison accounting records. Generated output and downloaded templates are ignored by Git.

## Private operation and review

Copy the identity example to a Git-ignored `identity.private.json` and supply your own values locally. Keep source ledgers, tax account numbers, refund evidence, bank exports, and completed forms outside public version control. Preserve existing workbook formulas; put the audit trail on a separate trace.

Reopen the generated PDF, verify all intended values and the blank signature, then inspect it visually. A changed City template, unknown period, source mismatch, or unconfirmed adjustment requires review. Final signing, payment, and submission remain owner actions. This code does not pay or submit anything.

The public edition excludes live connectors, private ledgers, completed historical forms, and the original private audit evidence. Local checks demonstrate calculation and PDF readback behavior using sample values, not City acceptance or a production accounting run.
