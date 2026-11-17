import importlib.util
import pathlib
import unittest
from unittest.mock import patch

SOURCE = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "probe-jaxa-gsmap-staging.py"
spec = importlib.util.spec_from_file_location("jaxa_probe", SOURCE)
jaxa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(jaxa)


class FakeFtps:
    def __init__(self, timeout, context):
        self.calls = []
        self.closed = False

    def connect(self, host, port, timeout):
        self.calls.append("connect")

    def auth(self):
        self.calls.append("auth")

    def login(self, username, password):
        self.calls.append("login")

    def prot_p(self):
        self.calls.append("prot_p")

    def nlst(self, path):
        self.calls.append("nlst")
        return [
            "/realtime_ver/v9/latest/gsmap_nrt.2026111715.0.1d.dat.gz",
            "/realtime_ver/v9/latest/gsmap_gauge_nrt.2026111715.0.1d.dat.gz",
            "/realtime_ver/v9/latest/README",
        ]

    def close(self):
        self.closed = True
        self.calls.append("close")


class JaxaV9Tests(unittest.TestCase):
    def test_version9_only(self):
        self.assertEqual(jaxa.DIR, "/realtime_ver/v9/latest")
        self.assertIsNone(jaxa.classify_product("file.txt"))
        self.assertIsNone(jaxa.classify_product("README"))
        self.assertEqual(
            jaxa.classify_product("gsmap_nrt.2026111715.0.1d.dat.gz"),
            "GSMAP_NRT_V9_CANDIDATE",
        )
        self.assertEqual(
            jaxa.classify_product("gsmap_gauge_nrt.2026111715.dat.gz"),
            "GSMAP_GAUGE_NRT_V9_CANDIDATE",
        )

    def test_no_credentials_means_tlsonly_and_no_login(self):
        holder = []

        def factory(**kwargs):
            obj = FakeFtps(**kwargs)
            holder.append(obj)
            return obj

        data = jaxa.check_jaxa_ftp(ftp_factory=factory)
        self.assertEqual(data["state"], "FTPS_READY_CREDENTIALS_NOT_CONFIGURED")
        self.assertTrue(data["secureTransportConfirmed"])
        self.assertFalse(data["credentialsUsed"])
        self.assertEqual(holder[0].calls, ["connect", "auth", "close"])
        self.assertFalse(data["meteorologicalValueValidated"])
        self.assertFalse(data["publishedToAndroid"])
        self.assertEqual(data["filesDownloaded"], 0)

    def test_secret_login_after_tls_then_protect_data_channel(self):
        holder = []
        def factory(**kwargs):
            obj = FakeFtps(**kwargs)
            holder.append(obj)
            return obj

        fake_secret = "SHOULD_NEVER_APPEAR_IN_OUTPUT"
        report = jaxa.check_jaxa_ftp(
            username="runner-secret",
            password=fake_secret,
            ftp_factory=factory,
        )
        self.assertEqual(
            holder[0].calls,
            ["connect", "auth", "login", "prot_p", "nlst", "close"],
        )
        self.assertEqual(report["state"], "V9_DIRECTORY_LISTED_NO_NUMERIC_FIELD")
        self.assertEqual(report["filesDownloaded"], 0)
        self.assertEqual(len(report["sampleFiles"]), 2)
        self.assertNotIn(fake_secret, str(report))
        self.assertTrue(report["credentialsUsed"])

    def test_tls_rejected_fails_closed_without_credentials(self):
        class NoTls(FakeFtps):
            def auth(self):
                raise RuntimeError("tls blocked")

        report = jaxa.check_jaxa_ftp(
            username="someone",
            password="sensitive-placeholder-not-real",
            ftp_factory=lambda **kw: NoTls(**kw),
        )
        self.assertEqual(report["state"], "FTPS_UNSUPPORTED_OR_UNREACHABLE")
        self.assertIsNone(report.get("value"))
        self.assertFalse(report["credentialsUsed"])
        self.assertFalse(report["secureTransportConfirmed"])

    def test_invalid_or_huge_name_is_not_meteorological_data(self):
        self.assertIsNone(jaxa.classify_product("gsmap_nrt.jpeg"))
        self.assertIsNone(jaxa.classify_product("x" * 200 + ".dat.gz"))


if __name__ == "__main__":
    unittest.main()
