"Test the JSON-backed HTTP API without third-party dependencies."

from __future__ import annotations

import json
import shutil
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

import server


ROOT = Path(__file__).resolve().parents[1]


class ServerApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_dir = Path(self.temp_dir.name)
        (self.project_dir / "data").mkdir()
        shutil.copy2(ROOT / "data" / "foods.json", self.project_dir / "data" / "foods.json")
        shutil.copy2(
            ROOT / "data" / "custom_items.json",
            self.project_dir / "data" / "custom_items.json",
        )
        (self.project_dir / "index.html").write_text("<!doctype html><title>test</title>", encoding="utf-8")

        self.httpd = server.create_server("127.0.0.1", 0, self.project_dir)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        host, port = self.httpd.server_address
        self.base_url = f"http://{host}:{port}"

    def tearDown(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=2)
        self.temp_dir.cleanup()

    def request(
        self,
        method: str,
        path: str,
        body: dict | None = None,
        headers: dict | None = None,
    ) -> tuple[int, dict, dict]:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=data,
            method=method,
            headers={"Content-Type": "application/json", **(headers or {})},
        )
        try:
            response = urllib.request.urlopen(request, timeout=2)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            payload = json.loads(response.read().decode("utf-8"))
            return response.status, payload, dict(response.headers)

    @staticmethod
    def sample_item(**overrides) -> dict:
        item = {
            "itemType": "restaurant",
            "name": "测试川菜馆",
            "category": "中餐",
            "cuisine": "川菜",
            "tags": ["附近", "家庭收藏"],
            "reason": "用于验证家庭共享美食库。",
            "emoji": "🍲",
            "image": "",
            "meal": "正餐",
            "budget": "实惠",
            "spice": "辣",
            "searchKeyword": "测试川菜馆",
        }
        item.update(overrides)
        return item

    def test_health_and_combined_menu(self) -> None:
        status, payload, headers = self.request("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(headers["Cache-Control"], "no-store")

        status, payload, _ = self.request("GET", "/api/foods")
        self.assertEqual(status, 200)
        self.assertEqual(payload["data"]["presetCount"], 92)
        self.assertEqual(payload["data"]["customCount"], 0)
        self.assertEqual(len(payload["data"]["items"]), 92)

    def test_create_update_conflict_and_delete(self) -> None:
        status, payload, _ = self.request("POST", "/api/custom-items", self.sample_item())
        self.assertEqual(status, 201)
        item_id = payload["data"]["id"]
        self.assertTrue(item_id.startswith("custom-"))
        self.assertEqual(payload["revision"], 1)

        status, payload, _ = self.request("GET", "/api/foods")
        self.assertEqual(status, 200)
        self.assertEqual(payload["data"]["customCount"], 1)
        self.assertEqual(len(payload["data"]["items"]), 93)

        status, payload, _ = self.request(
            "PUT",
            f"/api/custom-items/{item_id}",
            self.sample_item(name="过期修改"),
            {"If-Match": "0"},
        )
        self.assertEqual(status, 409)
        self.assertFalse(payload["ok"])

        status, payload, _ = self.request(
            "PUT",
            f"/api/custom-items/{item_id}",
            self.sample_item(name="更新后的餐厅"),
            {"If-Match": "1"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["data"]["name"], "更新后的餐厅")
        self.assertEqual(payload["revision"], 2)

        status, payload, _ = self.request(
            "DELETE",
            f"/api/custom-items/{item_id}",
            headers={"If-Match": "2"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["revision"], 3)

        document = json.loads(
            (self.project_dir / "data" / "custom_items.json").read_text(encoding="utf-8")
        )
        self.assertEqual(document["revision"], 3)
        self.assertEqual(document["items"], [])
        self.assertTrue((self.project_dir / "data" / "custom_items.json.bak").exists())

    def test_validation_and_revision_requirement(self) -> None:
        status, payload, _ = self.request(
            "POST",
            "/api/custom-items",
            self.sample_item(name=""),
        )
        self.assertEqual(status, 400)
        self.assertIn("名称不能为空", payload["error"])

        status, payload, _ = self.request("POST", "/api/custom-items", self.sample_item())
        item_id = payload["data"]["id"]
        status, payload, _ = self.request(
            "DELETE",
            f"/api/custom-items/{item_id}",
        )
        self.assertEqual(status, 428)
        self.assertIn("If-Match", payload["error"])

    def test_reason_and_tags_can_be_empty(self) -> None:
        status, payload, _ = self.request(
            "POST",
            "/api/custom-items",
            self.sample_item(tags=[], reason=""),
        )
        self.assertEqual(status, 201)
        self.assertEqual(payload["data"]["tags"], [])
        self.assertEqual(payload["data"]["reason"], "")


if __name__ == "__main__":
    unittest.main()
