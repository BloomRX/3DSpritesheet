import hashlib
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

from scripts.spriteforge_launcher import (
    BootstrapError,
    build_parser,
    comfyui_server_status,
    model_slug,
    model_target_path,
    node_version_meets_minimum,
    package_dependencies_ready,
    sha256_file,
)


class BootstrapHelpersTest(unittest.TestCase):
    def test_model_id_is_safe_for_a_directory_name(self):
        self.assertEqual(model_slug("my image/model v1"), "my-image-model-v1")
        self.assertEqual(model_slug("../../weights"), "weights")

    def test_node_version_checks_full_electron_minimum(self):
        self.assertTrue(node_version_meets_minimum("v22.12.0"))
        self.assertTrue(node_version_meets_minimum("v24.0.0"))
        self.assertFalse(node_version_meets_minimum("v22.11.9"))
        self.assertFalse(node_version_meets_minimum("v20.19.0"))
        self.assertFalse(node_version_meets_minimum("unknown"))

    def test_model_target_stays_inside_cache(self):
        target = model_target_path({"id": "depth-model", "filename": "weights.safetensors"})
        self.assertEqual(target.name, "weights.safetensors")
        self.assertEqual(target.parent.name, "depth-model")
        self.assertTrue(target.parent.parent.name == "models")

    def test_model_filename_cannot_escape_cache(self):
        with self.assertRaises(BootstrapError):
            model_target_path({"id": "depth-model", "filename": "../outside.bin"})

    def test_sha256_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "weights.bin"
            path.write_bytes(b"spriteforge-test")
            self.assertEqual(sha256_file(path), hashlib.sha256(b"spriteforge-test").hexdigest())

    def test_installed_npm_tree_matches_lockfile(self):
        self.assertTrue(package_dependencies_ready())

    def test_desktop_window_is_the_default_launcher_mode(self):
        args = build_parser().parse_args([])
        self.assertFalse(args.web)
        self.assertFalse(args.no_browser)

    def test_comfyui_probe_reports_unavailable_without_installing(self):
        with patch.dict("os.environ", {"COMFYUI_URL": "http://127.0.0.1:1"}):
            status = comfyui_server_status()
        self.assertFalse(status["running"])
        self.assertEqual(status["endpoint"], "http://127.0.0.1:1")


if __name__ == "__main__":
    unittest.main()
