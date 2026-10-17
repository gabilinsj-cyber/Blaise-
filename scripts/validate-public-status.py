"""Validate the application route, independently of container health."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def validate(payload, http_status, enabled, approved, now=None):
    if not isinstance(payload, dict):
        raise ValueError('public_status_object_required')
    if not enabled or not approved:
        expected = 'official_status_not_enabled' if not enabled else 'source_terms_not_approved'
        if http_status != 503 or payload.get('error') != expected:
            raise ValueError('public_status_configuration_contract_failed')
        return 'ROUTE_PRESENT_DATA_DISABLED'
    if http_status != 200:
        raise ValueError('public_status_unavailable')
    if payload.get('contract') != 'BLAISE_RJ_PUBLIC_OFFICIAL_STATUS_V1':
        raise ValueError('public_status_wrong_contract')
    if payload.get('usableOfficialProducts') is not True or payload.get('workerActive') is not True:
        raise ValueError('public_status_no_active_product')
    try:
        stamp = datetime.fromisoformat(payload['generatedAt'].replace('Z', '+00:00'))
        if stamp.tzinfo is None:
            raise ValueError('timezone_required')
        age = ((now or datetime.now(timezone.utc)) - stamp).total_seconds()
        if not 0 <= age <= 300:
            raise ValueError('stale_or_future')
    except (KeyError, TypeError, AttributeError, ValueError) as exc:
        raise ValueError('public_status_invalid_timestamp') from exc
    return 'ROUTE_PRESENT_FRESH_ENVELOPE_NOT_MARINE_INGESTION_PROOF'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--file', required=True)
    parser.add_argument('--http-status', required=True, type=int)
    parser.add_argument('--enabled', required=True, choices=['true', 'false'])
    parser.add_argument('--approved', required=True, choices=['true', 'false'])
    args = parser.parse_args()
    try:
        payload = json.loads(Path(args.file).read_text())
        print(validate(payload, args.http_status, args.enabled == 'true', args.approved == 'true'))
    except (OSError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc


if __name__ == '__main__':
    main()
