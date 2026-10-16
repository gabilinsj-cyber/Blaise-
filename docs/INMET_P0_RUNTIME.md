# INMET P0 runtime publication gate

This gate connects the already validated INMET CAP warning pipeline to the protected Blaise backend P0 endpoint without enabling publication by default.

## Default state

Automatic INMET P0 publication remains disabled unless both `BLAISE_INMET_WARNINGS_ENABLED=true` and `BLAISE_INMET_P0_PUBLISH_ENABLED=true` are explicitly configured. Enabling publication without INMET warnings fails startup closed.

When publication is disabled, every successful INMET refresh continues to evaluate and stage the deterministic P0 batch in memory, records only bounded counts plus the batch SHA-256 in runtime status, and discards candidate payloads after the status projection.

## Authenticated runtime bridge

When publication is explicitly enabled, runtime additionally requires:

- `BLAISE_INMET_P0_BACKEND_BASE_URL` as a root HTTPS URL.
- `BLAISE_P0_AUDIENCE` equal to the same HTTPS origin.
- `BLAISE_P0_SERVICE_ACCOUNT` as the exact expected Google service-account identity already enforced by `/v1/internal/p0`.

The runtime uses Application Default Credentials / Cloud Run service identity through `google-auth-library` to obtain a short-lived Google ID token for the configured audience. No long-lived service-account JSON key or static bearer token is stored. Authorization is refreshed for each alert submission.

The sender keeps redirects disabled, uses the existing seven-second bounded request timeout and accepts only the protected backend `202 {"accepted":true}` contract. The backend revalidates every P0 payload, applies concurrency limits and replay protection, and performs the FCM publish. Runtime never treats backend acceptance as proof of device delivery.

## Failure behavior

Source freshness and P0 delivery are tracked separately. If INMET CAP refresh succeeds but policy/staging fails, the source cache can remain current while P0 evaluation is marked blocked. If authenticated P0 publication fails, the source cache remains current, the INMET scheduler task is marked failed so normal/severe cadence retries it, and runtime status exposes only a fixed bounded error code. Upstream bodies, municipality identifiers, warning titles and bearer tokens are not exposed in status.

## Evidence semantics

`BACKEND_ACCEPTED` means every alert in the staged batch received the backend P0 `202 accepted` contract; duplicates are counted separately. It does **not** mean FCM delivery to a handset was proven. Real FCM/device evidence remains an external production gate.
