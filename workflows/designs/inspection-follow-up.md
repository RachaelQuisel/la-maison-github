# Property inspection follow-up

An inspector records an issue, routes it to a contractor, and the chosen appointment is confirmed to the relevant people.

## Inputs

- A scheduled inspection and checklist result
- Issue category, description, and permitted attachments
- A private contractor roster and available appointment windows

## Workflow design

1. Record the inspection finding and stable issue ID.
2. Map its category to the correct contractor role.
3. Send a private scheduling request with the permitted issue details.
4. Validate and reserve the chosen appointment.
5. Confirm the saved appointment to the contractor and inspector.
6. Post an appropriate maintenance summary and track exceptions separately.

## Implementation status

The related private turnover app has checklist, photo, history, launch, and testing documentation. That does not establish the full contractor-routing and scheduling integration depicted in the video. The dispatch backend and its confirmation/delivery audit have not been verified for this publication.

## Acceptance checks

Test valid input, missing input, changed or canceled work, duplicate delivery/submission, permission failure, provider failure, and recovery. Verify saved downstream state and message delivery separately. No production execution is performed by this document.
