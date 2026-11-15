"""Unit tests for Agent 13 disabled runtime staging. No network or app imports."""
import importlib.util
import pathlib
import unittest

SCRIPT = pathlib.Path(__file__).with_name("stage-agent13-runtime.py")
spec = importlib.util.spec_from_file_location("stage_agent13", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

BASE = """import http from 'node:http';
const scientificHandler = createScientificHandler(baseHandler);
const server = http.createServer(createDrainingHandler(scientificHandler, readiness));
const serverShutdown = createGracefulShutdown(server, readiness);
"""
DIRECT = """import http from 'node:http';
const scientificHandler = createScientificHandler(baseHandler);
const server = http.createServer(scientificHandler);
const serverShutdown = createGracefulShutdown(server, readiness);
"""
class StageAgent13Tests(unittest.TestCase):
    def test_exact_server_declaration_not_confused_by_shutdown(self):
        updated, result = mod.prepare(BASE)
        self.assertIn("STAGING_READY_WITH_UPSTREAM_scientificHandler", result)
        self.assertIn("agent13: null", updated)
        self.assertIn("verifyOperatorOidc: null", updated)
        self.assertIn("const serverShutdown", updated)
        self.assertEqual(updated.count("const server ="), 1)

    def test_idempotent_when_already_disabled(self):
        first, _ = mod.prepare(BASE)
        second, status = mod.prepare(first)
        self.assertEqual(first, second)
        self.assertEqual(status, "ALREADY_STAGED_DISABLED")

    def test_direct_server_variant(self):
        updated, _ = mod.prepare(DIRECT)
        self.assertIn("http.createServer(agent13OperatorHandler)", updated)

    def test_duplicate_servers_are_rejected(self):
        with self.assertRaisesRegex(ValueError,"HTTP_SERVER_ANCHORS_2_EXPECTED_1"):
            mod.prepare(BASE + "const server = http.createServer(scientificHandler);\n")

    def test_unknown_structure_is_rejected(self):
        with self.assertRaisesRegex(ValueError,"HTTP_SERVER_ANCHORS_0_EXPECTED_1"):
            mod.prepare("import http from 'node:http';\nconst server = alternateFactory();\n")

    def test_existing_agent13_wiring_not_overwritten(self):
        with self.assertRaisesRegex(ValueError,"EXISTING_AGENT13_WIRING_REQUIRES_MANUAL_REVIEW"):
            mod.prepare(BASE+"const createRjAgent13OperatorHttpHandler = 1;\n")

if __name__ == "__main__":
    unittest.main()
