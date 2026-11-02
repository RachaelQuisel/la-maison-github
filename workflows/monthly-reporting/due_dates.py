"""Santa Barbara TOT/TBID deadlines by return month.

Source: City of Santa Barbara Finance Department email dated 2026-07-24 and
City TOT page. The 15th-day rule is effective 2026-08-01. Entries are keyed by
(return year, return month) and contain deadlines in the following month.

USPS uses the postmark deadline. City Hall and FedEx use the receipt deadline.
Weekends and holidays do not extend the statutory 15th; the City calendar may
therefore publish an earlier City Hall/FedEx receipt date.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

DeliveryMethod = Literal["usps", "city-hall", "fedex"]

SOURCE_REVISION = "City notice 2026-07-24; 15th-day rule effective 2026-08-01"

# (City Hall/FedEx receipt deadline, USPS postmark deadline)
DUE_DATES: dict[tuple[int, int], tuple[date, date]] = {
    # Returns January 2026 through June 2026 used the former 10th-day rule.
    (2026, 1):  (date(2026, 2, 10), date(2026, 2, 10)),
    (2026, 2):  (date(2026, 3, 10), date(2026, 3, 10)),
    (2026, 3):  (date(2026, 4, 9),  date(2026, 4, 10)),
    (2026, 4):  (date(2026, 5, 7),  date(2026, 5, 9)),
    (2026, 5):  (date(2026, 6, 10), date(2026, 6, 10)),
    (2026, 6):  (date(2026, 7, 10), date(2026, 7, 10)),
    # New 15th-day rule, effective with the July 2026 return.
    (2026, 7):  (date(2026, 8, 13), date(2026, 8, 15)),
    (2026, 8):  (date(2026, 9, 15), date(2026, 9, 15)),
    (2026, 9):  (date(2026, 10, 15), date(2026, 10, 15)),
    (2026, 10): (date(2026, 11, 12), date(2026, 11, 14)),
    (2026, 11): (date(2026, 12, 15), date(2026, 12, 15)),
    (2026, 12): (date(2027, 1, 14), date(2027, 1, 15)),
    # City-published 2027 calendar. December 2027 return is excluded because
    # its January 2028 deadline was not present in the source notice.
    (2027, 1):  (date(2027, 2, 15), date(2027, 2, 15)),
    (2027, 2):  (date(2027, 3, 15), date(2027, 3, 15)),
    (2027, 3):  (date(2027, 4, 15), date(2027, 4, 15)),
    (2027, 4):  (date(2027, 5, 13), date(2027, 5, 15)),
    (2027, 5):  (date(2027, 6, 15), date(2027, 6, 15)),
    (2027, 6):  (date(2027, 7, 15), date(2027, 7, 15)),
    (2027, 7):  (date(2027, 8, 12), date(2027, 8, 14)),
    (2027, 8):  (date(2027, 9, 15), date(2027, 9, 15)),
    (2027, 9):  (date(2027, 10, 14), date(2027, 10, 15)),
    (2027, 10): (date(2027, 11, 15), date(2027, 11, 15)),
    (2027, 11): (date(2027, 12, 15), date(2027, 12, 15)),
}


def deadlines_for(return_year: int, return_month: int) -> tuple[date, date]:
    """Return (City Hall/FedEx receipt, USPS postmark) deadlines."""
    if not 1 <= return_month <= 12:
        raise ValueError(f"return_month must be 1-12, got {return_month}")
    try:
        return DUE_DATES[(return_year, return_month)]
    except KeyError as exc:
        raise ValueError(
            f"No verified Santa Barbara deadline for {return_year}-{return_month:02d}. "
            "Check the current City TOT calendar before filing."
        ) from exc


def deadline_for(return_year: int, return_month: int, delivery_method: DeliveryMethod) -> date:
    """Return the applicable deadline for the selected delivery method."""
    receipt, postmark = deadlines_for(return_year, return_month)
    if delivery_method == "usps":
        return postmark
    if delivery_method in {"city-hall", "fedex"}:
        return receipt
    raise ValueError(f"Unsupported delivery method: {delivery_method!r}")


def is_late(
    return_year: int,
    return_month: int,
    filing_date: date,
    delivery_method: DeliveryMethod,
) -> bool:
    """Return whether the selected filing date is after its applicable deadline."""
    return filing_date > deadline_for(return_year, return_month, delivery_method)
