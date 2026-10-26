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
    normalized_command,
    package_dependencies_ready,
    sha256_file,
    tool_status,
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

    def test_windows_batch_command_quotes_program_files_path_for_cmd(self):
        with patch("scripts.spriteforge_launcher.os.name", "nt"), patch("scripts.spriteforge_launcher.Path") as path_type, patch.dict(
            "os.environ", {"COMSPEC": r"C:\Windows\System32\cmd.exe"}
        ):
            path_type.return_value.suffix = ".CMD"
            command = normalized_command([r"C:\Program Files\nodejs\npm.CMD", "ci"])
        self.assertEqual(
            command,
            r'"C:\Windows\System32\cmd.exe" /d /s /c ""C:\Program Files\nodejs\npm.CMD" ci"',
        )

    def test_failed_npm_probe_is_not_reported_as_installed(self):
        with patch("scripts.spriteforge_launcher.find_executable", return_value=r"C:\Program Files\nodejs\npm.CMD"), patch(
            "scripts.spriteforge_launcher.read_version", return_value=("npm command failed", None)
        ):
            status = tool_status("npm")
        self.assertFalse(status["installed"])
        self.assertEqual(status["path"], r"C:\Program Files\nodejs\npm.CMD")

    def test_windows_doctor_without_python_exits_before_install_logic(self):
        launcher = (Path(__file__).resolve().parents[1] / "spriteforge.cmd").read_text(encoding="utf-8")
        self.assertIn('if /I "%~1"=="doctor" (', launcher)
        doctor_block = launcher.split('if /I "%~1"=="doctor" (', 1)[1].split("  )", 1)[0]
        self.assertIn("exit /b 1", doctor_block)
        self.assertNotIn("winget install", doctor_block)
        self.assertNotIn("(winget)", launcher)


if __name__ == "__main__":
    unittest.main()
