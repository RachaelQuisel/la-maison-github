# Guest door codes

A booking receives time-bounded access, messages communicate it privately, and the access is revoked after checkout.

## Inputs

- Confirmed booking and arrival/departure times
- A supported lock integration and its documented permissions
- Private message destinations and delivery state

## Workflow design

1. Create an access record tied to the reservation identity.
2. Provision a unique credential using the lock provider’s supported interface.
3. Set activation and expiry in the property timezone.
4. Send access details only to the intended guest through a private channel.
5. Handle date changes and cancellations against the same access record.
6. Verify revocation and retry failures without exposing the credential in logs.

## Implementation status

No real credential, derivation rule, lock account, access schedule, guest message, or connector secret is published. A complete provisioning/revocation implementation was not verified. The operational calendar code’s access-review reminder does not itself program a lock.

## Acceptance checks

Test valid input, missing input, changed or canceled work, duplicate delivery/submission, permission failure, provider failure, and recovery. Verify saved downstream state and message delivery separately. No production execution is performed by this document.
