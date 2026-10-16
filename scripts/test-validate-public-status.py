import importlib.util
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
spec = importlib.util.spec_from_file_location('validator', Path(__file__).with_name('validate-public-status.py'))
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class PublicStatusGateTest(unittest.TestCase):
    now = datetime(2026, 10, 15, 13, 0, tzinfo=timezone.utc)

    def payload(self):
        return dict(contract='BLAISE_RJ_PUBLIC_OFFICIAL_STATUS_V1', usableOfficialProducts=True,
                    workerActive=True, generatedAt=self.now.isoformat())

    def test_fresh_enabled_product(self):
        self.assertIn('FRESH_ENVELOPE', validator.validate(self.payload(), 200, True, True, self.now))

    def test_configuration_disables_data_without_hiding_route(self):
        for enabled, approved, error in [(False, False, 'official_status_not_enabled'),
                                         (True, False, 'source_terms_not_approved')]:
            self.assertEqual('ROUTE_PRESENT_DATA_DISABLED', validator.validate(dict(error=error), 503, enabled, approved))

    def test_missing_route_always_rejected(self):
        for enabled, approved in [(True, True), (True, False), (False, False)]:
            with self.assertRaises(ValueError):
                validator.validate(dict(error='not_found'), 404, enabled, approved)

    def test_unavailable_or_forged_product_rejected(self):
        for field, value in [('contract', 'other'), ('usableOfficialProducts', False), ('workerActive', False)]:
            payload = self.payload(); payload[field] = value
            with self.assertRaises(ValueError):
                validator.validate(payload, 200, True, True, self.now)
        with self.assertRaises(ValueError):
            validator.validate(self.payload(), 503, True, True, self.now)

    def test_stale_future_missing_and_naive_times_rejected(self):
        for stamp in [(self.now - timedelta(seconds=301)).isoformat(),
                      (self.now + timedelta(seconds=1)).isoformat(), None, '2026-10-15T13:00:00']:
            payload = self.payload(); payload['generatedAt'] = stamp
            with self.assertRaises(ValueError):
                validator.validate(payload, 200, True, True, self.now)


if __name__ == '__main__':
    unittest.main()
