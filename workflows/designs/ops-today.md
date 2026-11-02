# Ops Today daily briefing

A scheduled briefing gathers the day’s operational information and posts one shared update for the team.

## Inputs

- Date, property timezone, and source freshness timestamps
- Bookings, messages, maintenance, reviews, finance, and cleaning coverage
- A restricted team channel and posting identity

## Workflow design

1. Read the authoritative sources and preserve their timestamps.
2. Separate urgent actions from background information.
3. Do not replace a failed source read with an invented empty result.
4. Assemble a concise post with source links and assigned actions.
5. Post once using a property/date idempotency key.
6. Read back the saved message and handle corrections or failures explicitly.

## Implementation status

The public materials show the intended post and teammate experience. A complete production collector, connector configuration, source freshness policy, posting implementation, and recovery runbook were not located. This guide is a workflow design, not a claim that those components are implemented here.

## Acceptance checks

Test valid input, missing input, changed or canceled work, duplicate delivery/submission, permission failure, provider failure, and recovery. Verify saved downstream state and message delivery separately. No production execution is performed by this document.
