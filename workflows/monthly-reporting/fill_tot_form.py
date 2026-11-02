#!/usr/bin/env python3
"""Fill the current City of Santa Barbara TOT/TBID remittance form.

Line 1 is TOT-subject gross receipts, including taxable charges and fees.
Line 5 is TBID-subject room rental revenue only. They are intentionally
separate and both are required.
"""

from __future__ import annotations

import argparse
import calendar
import hashlib
import json
import os
import tempfile
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from zoneinfo import ZoneInfo

from pypdf import PdfReader, PdfWriter
from pypdf.generic import DictionaryObject, NameObject, TextStringObject

from due_dates import DeliveryMethod, deadline_for, deadlines_for, is_late

TOT_ACCOUNT_NUMBER = ""
BUSINESS_NAME = ""
PHYSICAL_LOCATION = ""
FILER_NAME = ""
FILER_EMAIL = ""
FILER_PHONE = ""

TOT_RATE = Decimal("0.12")
TBID_RATE = Decimal("0.02")
LATE_PENALTY_RATE = Decimal("0.10")
CENT = Decimal("0.01")
LOCAL_TZ = ZoneInfo("America/Los_Angeles")

PROJECT_DIR = Path(__file__).resolve().parent
TEMPLATE_PATH = PROJECT_DIR / "templates" / "TOT+TBID Remittance Form effective 2026-08-01.pdf"
TEMPLATE_SHA256 = "b9543fd47a24e440f570773fe96159990d8c140dff7b6bbfed8b9afafbf008b8"
OUTPUT_DIR = PROJECT_DIR / "output"

EXPECTED_FIELDS = {
    "Filing Period", "TOT Account Number", "Business Name", "Occupancy Rate",
    "Physical Location", "LineA", "LineB", "LineC", "Total1", "Total2",
    "LineD", "LineE", "LineF", "Total3", "Total4", "GrandTotal1",
    "LineG", "LineH", "LineI", "GrandTotal2", "Name", "Signature",
    "Email", "Phone", "Date",
}



def load_identity(path: Path) -> None:
    """Read a private, explicitly supplied identity. No property defaults ship here."""
    data = json.loads(path.read_text())
    required = ("account_number", "business_name", "location", "filer_name", "email", "phone")
    if not isinstance(data, dict) or any(not isinstance(data.get(k), str) or not data[k].strip() for k in required):
        raise ValueError("Identity JSON needs six nonempty strings: " + ", ".join(required))
    global TOT_ACCOUNT_NUMBER, BUSINESS_NAME, PHYSICAL_LOCATION, FILER_NAME, FILER_EMAIL, FILER_PHONE
    TOT_ACCOUNT_NUMBER, BUSINESS_NAME, PHYSICAL_LOCATION, FILER_NAME, FILER_EMAIL, FILER_PHONE = (data[k] for k in required)

def cents(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def money(value: Decimal) -> str:
    """Format a monetary value with commas and exactly two decimal places."""
    return f"{cents(value):,.2f}"


def compute_lines(
    *,
    line1: Decimal,
    line5: Decimal,
    line2a: Decimal = Decimal("0"),
    line2b: Decimal = Decimal("0"),
    line6a: Decimal = Decimal("0"),
    line6b: Decimal = Decimal("0"),
    late: bool = False,
    additional_penalty_interest: Decimal = Decimal("0"),
    adjustments: Decimal = Decimal("0"),
) -> dict[str, Decimal]:
    """Compute current-form TOT and TBID lines with separate tax bases."""
    values = {
        "line1": line1, "line5": line5, "line2a": line2a, "line2b": line2b,
        "line6a": line6a, "line6b": line6b,
        "additional_penalty_interest": additional_penalty_interest,
    }
    for name, value in values.items():
        if value < 0:
            raise ValueError(f"{name} must not be negative")
    if line2a + line2b > line1:
        raise ValueError("TOT deductions exceed Line 1")
    if line6a + line6b > line5:
        raise ValueError("TBID deductions exceed Line 5")

    line3 = cents(line1 - line2a - line2b)
    line4 = cents(line3 * TOT_RATE)
    line7 = cents(line5 - line6a - line6b)
    line8 = cents(line7 * TBID_RATE)
    line9 = cents(line4 + line8)
    first_penalty = cents(line9 * LATE_PENALTY_RATE) if late else Decimal("0.00")
    line12 = cents(line9 + first_penalty + additional_penalty_interest + adjustments)
    return {
        "line1": cents(line1), "line2a": cents(line2a), "line2b": cents(line2b),
        "line3": line3, "line4": line4, "line5": cents(line5),
        "line6a": cents(line6a), "line6b": cents(line6b), "line7": line7,
        "line8": line8, "line9": line9, "first_penalty": first_penalty,
        "additional_penalty_interest": cents(additional_penalty_interest),
        "adjustments": cents(adjustments), "line12": line12,
    }


def build_field_values(
    return_month: int,
    return_year: int,
    occupancy_pct: Decimal | None,
    filing_date: date,
    lines: dict[str, Decimal],
) -> dict[str, str]:
    occupancy = ""
    if occupancy_pct is not None:
        occupancy = f"{occupancy_pct.quantize(CENT):f}".rstrip("0").rstrip(".") + "%"
    return {
        "Filing Period": f"{calendar.month_name[return_month]} {return_year}",
        "TOT Account Number": TOT_ACCOUNT_NUMBER,
        "Business Name": BUSINESS_NAME,
        "Occupancy Rate": occupancy,
        "Physical Location": PHYSICAL_LOCATION,
        "LineA": money(lines["line1"]),
        "LineB": money(lines["line2a"]) if lines["line2a"] else "",
        "LineC": money(lines["line2b"]) if lines["line2b"] else "",
        "Total1": money(lines["line3"]),
        "Total2": money(lines["line4"]),
        "LineD": money(lines["line5"]),
        "LineE": money(lines["line6a"]) if lines["line6a"] else "",
        "LineF": money(lines["line6b"]) if lines["line6b"] else "",
        "Total3": money(lines["line7"]),
        "Total4": money(lines["line8"]),
        "GrandTotal1": money(lines["line9"]),
        "LineG": money(lines["first_penalty"]) if lines["first_penalty"] else "",
        "LineH": money(lines["additional_penalty_interest"]) if lines["additional_penalty_interest"] else "",
        "LineI": money(lines["adjustments"]) if lines["adjustments"] else "",
        "GrandTotal2": money(lines["line12"]),
        "Name": FILER_NAME,
        "Email": FILER_EMAIL,
        "Phone": FILER_PHONE,
        "Date": f"{filing_date:%B} {filing_date.day}, {filing_date.year}",
    }


def validate_template() -> set[str]:
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Required City template is missing: {TEMPLATE_PATH}")
    digest = hashlib.sha256(TEMPLATE_PATH.read_bytes()).hexdigest()
    if digest != TEMPLATE_SHA256:
        raise ValueError(f"Unexpected City template checksum: {digest}")
    fields = set((PdfReader(str(TEMPLATE_PATH)).get_fields() or {}).keys())
    if fields != EXPECTED_FIELDS:
        raise ValueError(
            f"City template fields changed. Missing={sorted(EXPECTED_FIELDS-fields)}; "
            f"unexpected={sorted(fields-EXPECTED_FIELDS)}"
        )
    return fields


def _field_value(field: object) -> str:
    value = field.get("/V") if hasattr(field, "get") else None
    return "" if value is None else str(value)


def fill_pdf(values: dict[str, str], out_path: Path, *, force: bool = False) -> None:
    fields = validate_template()
    unknown = set(values) - fields
    if unknown:
        raise ValueError(f"Unknown PDF fields: {sorted(unknown)}")
    if out_path.exists() and not force:
        raise FileExistsError(f"Refusing to overwrite {out_path}; pass --force to replace it")

    reader = PdfReader(str(TEMPLATE_PATH))
    writer = PdfWriter(clone_from=reader)
    # Normalize inherited form fonts and save the generated appearances so
    # filled amounts remain readable when other viewers reopen the form.
    acroform = writer.root_object["/AcroForm"].get_object()
    resources = acroform.setdefault(NameObject("/DR"), DictionaryObject())
    fonts = resources.setdefault(NameObject("/Font"), DictionaryObject())
    fonts[NameObject("/PublicHelvetica")] = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
        NameObject("/Encoding"): NameObject("/WinAnsiEncoding"),
    })
    appearance = TextStringObject("/PublicHelvetica 10 Tf 0 g")
    acroform[NameObject("/DA")] = appearance
    for page in writer.pages:
        for reference in page.get("/Annots", []):
            annotation = reference.get_object()
            if annotation.get("/Subtype") == "/Widget":
                annotation[NameObject("/DA")] = appearance
                annotation[NameObject("/DR")] = resources
                if "/Parent" in annotation:
                    parent = annotation["/Parent"].get_object()
                    parent[NameObject("/DA")] = appearance
                    parent[NameObject("/DR")] = resources
    for page in writer.pages:
        writer.update_page_form_field_values(page, values, auto_regenerate=False)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=out_path.name + ".", suffix=".tmp", dir=out_path.parent)
    os.close(fd)
    tmp_path = Path(tmp_name)
    try:
        with tmp_path.open("wb") as handle:
            writer.write(handle)
        check = PdfReader(str(tmp_path)).get_fields() or {}
        mismatches = {
            key: (_field_value(check.get(key)), expected)
            for key, expected in values.items()
            if _field_value(check.get(key)) != expected
        }
        if mismatches:
            raise ValueError(f"Filled PDF verification failed: {mismatches}")
        tmp_path.replace(out_path)
    finally:
        tmp_path.unlink(missing_ok=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--identity", type=Path, required=True, help="Private local JSON identity file; never commit it")
    parser.add_argument("--month", type=int, required=True)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--line1", type=Decimal, required=True, help="TOT gross receipts, including taxable fees")
    parser.add_argument("--line5", type=Decimal, required=True, help="TBID room rental revenue only")
    parser.add_argument("--line2a", type=Decimal, default=Decimal("0"))
    parser.add_argument("--line2b", type=Decimal, default=Decimal("0"))
    parser.add_argument("--line6a", type=Decimal, default=Decimal("0"))
    parser.add_argument("--line6b", type=Decimal, default=Decimal("0"))
    parser.add_argument("--additional-penalty-interest", type=Decimal, default=Decimal("0"))
    parser.add_argument("--adjustments", type=Decimal, default=Decimal("0"))
    parser.add_argument("--occupancy", type=Decimal, default=None, help="Optional hotels-only percentage")
    parser.add_argument("--filing-date", type=date.fromisoformat, default=None)
    parser.add_argument("--delivery-method", choices=("usps", "city-hall", "fedex"), required=True)
    parser.add_argument("--slug", default="draft")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def validate_args(args: argparse.Namespace) -> None:
    if not 1 <= args.month <= 12:
        raise ValueError("month must be 1-12")
    deadlines_for(args.year, args.month)
    if args.occupancy is not None and not Decimal("0") <= args.occupancy <= Decimal("100"):
        raise ValueError("occupancy must be between 0 and 100")


def main() -> None:
    args = parse_args()
    validate_args(args)
    load_identity(args.identity)
    filing_date = args.filing_date or date.today()
    method: DeliveryMethod = args.delivery_method
    late = is_late(args.year, args.month, filing_date, method)
    applicable_deadline = deadline_for(args.year, args.month, method)
    if (filing_date - applicable_deadline).days > 30 and not args.additional_penalty_interest:
        raise ValueError("More than 30 days late: obtain Line 10 penalties/interest from City staff")

    lines = compute_lines(
        line1=args.line1, line5=args.line5,
        line2a=args.line2a, line2b=args.line2b,
        line6a=args.line6a, line6b=args.line6b,
        late=late,
        additional_penalty_interest=args.additional_penalty_interest,
        adjustments=args.adjustments,
    )
    values = build_field_values(args.month, args.year, args.occupancy, filing_date, lines)
    out_path = OUTPUT_DIR / f"{args.year}-{args.month:02d}-tot-tbid-{args.slug}.pdf"
    fill_pdf(values, out_path, force=args.force)

    receipt_deadline, postmark_deadline = deadlines_for(args.year, args.month)
    print(f"Filled form: {out_path}")
    print(f"City Hall/FedEx receipt deadline: {receipt_deadline:%Y-%m-%d}")
    print(f"USPS postmark deadline: {postmark_deadline:%Y-%m-%d}")
    print(f"Selected method/date: {method} / {filing_date:%Y-%m-%d}{' (LATE)' if late else ''}")
    print(f"Line 1 TOT base: ${money(lines['line1'])}")
    print(f"Line 4 TOT due: ${money(lines['line4'])}")
    print(f"Line 5 TBID base: ${money(lines['line5'])}")
    print(f"Line 8 TBID due: ${money(lines['line8'])}")
    print(f"Combined before penalties: ${money(lines['line9'])}")
    print(f"Total due: ${money(lines['line12'])}")


if __name__ == "__main__":
    main()
