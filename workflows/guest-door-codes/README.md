# Guest door codes: platform automation and manual exceptions

This process uses hosting-platform and lock-provider settings, approved guest messages, and a manual exception path. No custom lock-provisioning source was recovered, so the guide does not attribute vendor functionality to a custom application.

## The operating path

The private operating instructions record Airbnb-managed codes for most bookings and manual handling for Vrbo. The Calendar workflow can remind the owner to review a Vrbo arrival; that reminder does not program a lock.

| Stage | Airbnb-managed path | Manual exception path |
|---|---|---|
| Confirmed booking | The connected platform generates the reservation credential | Owner reviews the stay and creates or selects the credential privately |
| Before arrival | Platform shares access details; approved templates can reference the reservation's actual code | Owner verifies the active window and communicates access privately |
| Stay changes or cancellation | Provider configuration governs the code update/removal | Owner updates access and guest communication together |
| Checkout | Provider expires access using the configured window | Owner verifies expiry or removes access |

The private message library has booking-confirmation, seven-day, and one-day pre-arrival templates. Those templates show intended wording and timing; they do not establish that a particular scheduler or dynamic-field binding is currently enabled.

## Provider behavior and configuration

Airbnb's [code-sharing guide](https://www.airbnb.com/help/article/3483) describes automatically generated reservation codes and guest delivery. Its [management guide](https://www.airbnb.com/help/article/3481) explains activation and the configurable checkout buffer. Its [change and cancellation guide](https://www.airbnb.com/help/article/3482) describes reservation updates and removing canceled access. These official instructions were reviewed November 2, 2026; they describe the vendor feature, not a readback of this property's settings.

The native connection screen, exact lock association, expiry buffer, backup-entry configuration, and active message schedule were not retrieved. The full private guide links the protected operating records and reconciles conflicting historical claims. A custom API listed in an old to-do document is not evidence that it was implemented.

## What stays private

Actual codes, guest phone data, credential-generation rules, lock identifiers, backup-entry details, and guest messages are excluded. Configuration verification should record timing and connection status without copying a working credential. No lock setting or access code was changed during this documentation work.

[Back to all projects](../../README.md)
