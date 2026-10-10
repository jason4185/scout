"""SDK-independent ABI and source-boundary checks for Scout.py."""

import ast
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "contract" / "Scout.py"


class ScoutAbiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = SOURCE.read_text(encoding="utf-8")
        cls.tree = ast.parse(cls.text)
        cls.contract = next(node for node in cls.tree.body if isinstance(node, ast.ClassDef) and node.name == "Scout")
        cls.methods = {
            node.name: node
            for node in cls.contract.body
            if isinstance(node, ast.FunctionDef)
            and any(ast.unparse(dec).startswith("gl.public") for dec in node.decorator_list)
        }

    def test_source_constraints(self):
        self.assertLess(len(self.text.encode("utf-8")), 52000)
        self.assertNotIn("DynArray", self.text)
        self.assertIn('py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng', self.text)
        self.assertNotIn("source_url", self.text)
        self.assertNotIn("evidence_standard", self.text)
        self.assertNotIn("HOSTS:", self.text)

    def test_public_method_counts_and_names(self):
        writes = [name for name, node in self.methods.items() if "gl.public.write" in ast.unparse(node.decorator_list)]
        views = [name for name, node in self.methods.items() if "gl.public.view" in ast.unparse(node.decorator_list)]
        self.assertEqual(len(writes), 15)
        self.assertEqual(len(views), 16)
        self.assertIn("subscribe", writes)
        self.assertIn("submit_alert", writes)
        self.assertEqual(set(writes) - {"subscribe", "fund_subscription"}, {
            "register_agent", "update_agent_operator", "update_agent_payout", "update_agent_profile",
            "set_agent_active", "create_service", "update_service", "cancel_subscription",
            "expire_subscription", "withdraw_subscription_refund", "submit_alert", "evaluate_delivery",
            "resolve_inconclusive_delivery",
        })

    def test_argument_boundaries(self):
        subscribe = self.methods["subscribe"]
        submit = self.methods["submit_alert"]
        self.assertEqual([arg.arg for arg in subscribe.args.args[1:]], [
            "buyer_agent_id", "service_id", "requirements", "allowed_topics", "duration_seconds",
            "max_paid_alerts", "max_total_spend", "max_submissions",
        ])
        self.assertEqual([arg.arg for arg in submit.args.args[1:]], [
            "subscription_id", "report_id", "report_url", "report_sha256", "metadata",
        ])

if __name__ == "__main__":
    unittest.main()
