# Scheduling cleaners by text

A cleaner receives an invitation, opens the available-date form, selects dates, and the saved assignment appears on the shared calendar.

## Inputs

- Unassigned turnover records with dates and time windows
- A cleaner identity and authorized contact destination
- The claim form and assignment/calendar writeback

## Workflow design

1. Generate open jobs from the reservation schedule.
2. Send the cleaner a private link to eligible dates.
3. Validate the selected dates and cleaner identity on submission.
4. Reserve a date atomically or reject it if another cleaner already claimed it.
5. Save the assignment, update the calendar, and confirm the accepted selection.
6. Keep retries idempotent so a repeated submission cannot create a second assignment.

## Implementation status

The reviewed materials describe Zapier, Twilio, a date-selection form, and Airtable writeback. The exact form/backend configuration, concurrency rules, authentication, and failure recovery have not been verified in a complete source export. The one-way staff-text sender is a different workflow.

## Acceptance checks

Test valid input, missing input, changed or canceled work, duplicate delivery/submission, permission failure, provider failure, and recovery. Verify saved downstream state and message delivery separately. No production execution is performed by this document.
