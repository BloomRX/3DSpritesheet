import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.mcp_config import install_mcp_config
from scripts.spriteforge_launcher import BootstrapError


class McpConfigInstallerTest(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.project = Path(self.temporary_directory.name) / "game project"
        self.project.mkdir()
        self.patcher = patch("scripts.mcp_config.find_executable", return_value="/usr/bin/node")
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.temporary_directory.cleanup()

    def test_claude_config_merges_and_is_idempotent(self):
        config_path = self.project / ".mcp.json"
        config_path.write_text(json.dumps({"mcpServers": {"existing": {"command": "other"}}}), encoding="utf-8")

        changed, result_path = install_mcp_config("claude", self.project)
        self.assertTrue(changed)
        self.assertEqual(result_path, config_path)
        config = json.loads(config_path.read_text(encoding="utf-8"))
        self.assertIn("existing", config["mcpServers"])
        self.assertEqual(config["mcpServers"]["spriteforge"]["command"], "/usr/bin/node")
        self.assertEqual(config["mcpServers"]["spriteforge"]["env"]["SPRITEFORGE_PROJECT_ROOT"], str(self.project.resolve()))

        changed_again, _ = install_mcp_config("claude", self.project)
        self.assertFalse(changed_again)

    def test_opencode_config_merges_other_mcp_and_preserves_theme(self):
        config_path = self.project / "opencode.json"
        config_path.write_text(json.dumps({"theme": "dark", "mcp": {"other": {"type": "local"}}}), encoding="utf-8")
        changed, _ = install_mcp_config("opencode", self.project)
        self.assertTrue(changed)
        config = json.loads(config_path.read_text(encoding="utf-8"))
        self.assertEqual(config["theme"], "dark")
        self.assertIn("other", config["mcp"])
        self.assertEqual(config["mcp"]["spriteforge"]["type"], "local")
        self.assertEqual(config["mcp"]["spriteforge"]["command"][0], "/usr/bin/node")

    def test_codex_config_appends_project_scoped_toml(self):
        config_path = self.project / ".codex" / "config.toml"
        config_path.parent.mkdir()
        config_path.write_text('[features]\nnew_thing = true\n', encoding="utf-8")
        changed, result_path = install_mcp_config("codex", self.project)
        self.assertTrue(changed)
        self.assertEqual(result_path, config_path)
        text = config_path.read_text(encoding="utf-8")
        self.assertIn("[features]", text)
        self.assertIn("[mcp_servers.spriteforge]", text)
        self.assertIn('command = "/usr/bin/node"', text)
        self.assertIn('SPRITEFORGE_PROJECT_ROOT = ', text)

    def test_does_not_overwrite_conflicting_json_entry(self):
        config_path = self.project / "opencode.json"
        original = {"mcp": {"spriteforge": {"type": "remote", "url": "https://example.invalid"}}}
        config_path.write_text(json.dumps(original), encoding="utf-8")
        with self.assertRaises(BootstrapError):
            install_mcp_config("opencode", self.project)
        self.assertEqual(json.loads(config_path.read_text(encoding="utf-8")), original)

    def test_does_not_duplicate_or_replace_codex_table(self):
        config_path = self.project / ".codex" / "config.toml"
        config_path.parent.mkdir()
        config_path.write_text('[mcp_servers.spriteforge]\ncommand = "custom"\n', encoding="utf-8")
        original = config_path.read_text(encoding="utf-8")
        with self.assertRaises(BootstrapError):
            install_mcp_config("codex", self.project)
        self.assertEqual(config_path.read_text(encoding="utf-8"), original)

    def test_rejects_config_symlink_escaping_workspace(self):
        outside = Path(self.temporary_directory.name) / "outside.json"
        outside.write_text("{}", encoding="utf-8")
        config_path = self.project / ".mcp.json"
        try:
            config_path.symlink_to(outside)
        except (OSError, NotImplementedError):
            self.skipTest("symlinks are unavailable on this platform")
        with self.assertRaises(BootstrapError):
            install_mcp_config("claude", self.project)
        self.assertEqual(outside.read_text(encoding="utf-8"), "{}")


if __name__ == "__main__":
    unittest.main()
