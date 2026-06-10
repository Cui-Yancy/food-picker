#!/usr/bin/env python3

"""Serve the PWA and its small JSON-backed family food library."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
import threading
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


MAX_BODY_BYTES = 32 * 1024
MAX_CUSTOM_ITEMS = 1000
ITEM_TYPES = {"restaurant", "food"}
MEALS = {"正餐", "轻食", "甜品"}
BUDGETS = {"实惠", "品质"}
SPICE_LEVELS = {"不辣", "辣"}


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def require_text(value: object, field: str, max_length: int) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{field}不能为空")
    text = value.strip()
    if len(text) > max_length:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{field}不能超过{max_length}个字符")
    return text


def optional_text(value: object, field: str, max_length: int, default: str = "") -> str:
    if value is None:
        return default
    if not isinstance(value, str):
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{field}格式不正确")
    text = value.strip()
    if len(text) > max_length:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{field}不能超过{max_length}个字符")
    return text


def validate_choice(value: object, field: str, choices: set[str]) -> str:
    if value not in choices:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{field}取值不正确")
    return str(value)


def normalize_item(value: object) -> dict:
    if not isinstance(value, dict):
        raise ApiError(HTTPStatus.BAD_REQUEST, "请求数据格式不正确")

    tags = value.get("tags", [])
    if not isinstance(tags, list) or len(tags) > 8:
        raise ApiError(HTTPStatus.BAD_REQUEST, "标签必须是最多8项的数组")

    normalized_tags = []
    for tag in tags:
        text = require_text(tag, "标签", 12)
        if text not in normalized_tags:
            normalized_tags.append(text)

    name = require_text(value.get("name"), "名称", 60)
    return {
        "itemType": validate_choice(value.get("itemType", "restaurant"), "类型", ITEM_TYPES),
        "name": name,
        "category": require_text(value.get("category"), "分类", 20),
        "cuisine": require_text(value.get("cuisine"), "菜系", 30),
        "tags": normalized_tags,
        "reason": require_text(value.get("reason"), "推荐理由", 160),
        "emoji": optional_text(value.get("emoji"), "图标", 8, "🍽️") or "🍽️",
        "image": optional_text(value.get("image"), "图片地址", 500),
        "meal": validate_choice(value.get("meal"), "用餐类型", MEALS),
        "budget": validate_choice(value.get("budget"), "预算", BUDGETS),
        "spice": validate_choice(value.get("spice"), "辣度", SPICE_LEVELS),
        "searchKeyword": optional_text(value.get("searchKeyword"), "搜索关键词", 80, name) or name,
    }


class FoodStore:
    def __init__(self, preset_path: Path, custom_path: Path):
        self.preset_path = preset_path
        self.custom_path = custom_path
        self.backup_path = custom_path.with_suffix(custom_path.suffix + ".bak")
        self.lock = threading.Lock()
        self._ensure_custom_file()

    @staticmethod
    def empty_document() -> dict:
        return {
            "schemaVersion": 1,
            "revision": 0,
            "updatedAt": None,
            "items": [],
        }

    def _ensure_custom_file(self) -> None:
        if self.custom_path.exists():
            self._read_custom()
            return
        self.custom_path.parent.mkdir(parents=True, exist_ok=True)
        self._atomic_write(self.empty_document(), create_backup=False)

    def _read_json(self, path: Path) -> object:
        try:
            with path.open("r", encoding="utf-8") as handle:
                return json.load(handle)
        except (OSError, json.JSONDecodeError) as error:
            raise ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, f"无法读取数据文件：{path.name}") from error

    def _read_custom(self) -> dict:
        document = self._read_json(self.custom_path)
        if (
            not isinstance(document, dict)
            or document.get("schemaVersion") != 1
            or not isinstance(document.get("revision"), int)
            or not isinstance(document.get("items"), list)
        ):
            raise ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, "custom_items.json结构不正确")
        return document

    def _atomic_write(self, document: dict, *, create_backup: bool = True) -> None:
        temp_path = None
        try:
            if create_backup and self.custom_path.exists():
                shutil.copy2(self.custom_path, self.backup_path)

            descriptor, temp_name = tempfile.mkstemp(
                prefix=f".{self.custom_path.name}.",
                suffix=".tmp",
                dir=self.custom_path.parent,
            )
            temp_path = Path(temp_name)
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                json.dump(document, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_path, self.custom_path)
        except OSError as error:
            raise ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, "共享美食库写入失败") from error
        finally:
            if temp_path and temp_path.exists():
                temp_path.unlink()

    @staticmethod
    def _assert_revision(document: dict, expected_revision: int | None) -> None:
        if expected_revision is None:
            raise ApiError(HTTPStatus.PRECONDITION_REQUIRED, "缺少If-Match revision")
        if document["revision"] != expected_revision:
            raise ApiError(HTTPStatus.CONFLICT, "共享美食库已被其他设备更新，请刷新后重试")

    @staticmethod
    def _next_document(document: dict, items: list[dict]) -> dict:
        return {
            "schemaVersion": 1,
            "revision": document["revision"] + 1,
            "updatedAt": utc_now(),
            "items": items,
        }

    def get_custom(self) -> dict:
        with self.lock:
            return self._read_custom()

    def get_all(self) -> dict:
        with self.lock:
            presets = self._read_json(self.preset_path)
            custom = self._read_custom()
            if not isinstance(presets, list):
                raise ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, "foods.json结构不正确")
            return {
                "items": [*presets, *custom["items"]],
                "presetCount": len(presets),
                "customCount": len(custom["items"]),
                "revision": custom["revision"],
                "updatedAt": custom["updatedAt"],
            }

    def create(self, value: object) -> tuple[dict, dict]:
        normalized = normalize_item(value)
        with self.lock:
            document = self._read_custom()
            if len(document["items"]) >= MAX_CUSTOM_ITEMS:
                raise ApiError(HTTPStatus.CONFLICT, "共享美食库已达到1000条上限")

            now = utc_now()
            item = {
                "id": f"custom-{uuid.uuid4()}",
                **normalized,
                "createdAt": now,
                "updatedAt": now,
            }
            updated = self._next_document(document, [*document["items"], item])
            self._atomic_write(updated)
            return item, updated

    def update(self, item_id: str, value: object, expected_revision: int | None) -> tuple[dict, dict]:
        normalized = normalize_item(value)
        with self.lock:
            document = self._read_custom()
            self._assert_revision(document, expected_revision)
            index = next(
                (index for index, item in enumerate(document["items"]) if item.get("id") == item_id),
                None,
            )
            if index is None:
                raise ApiError(HTTPStatus.NOT_FOUND, "未找到该共享美食")

            existing = document["items"][index]
            item = {
                "id": item_id,
                **normalized,
                "createdAt": existing.get("createdAt", utc_now()),
                "updatedAt": utc_now(),
            }
            items = list(document["items"])
            items[index] = item
            updated = self._next_document(document, items)
            self._atomic_write(updated)
            return item, updated

    def delete(self, item_id: str, expected_revision: int | None) -> dict:
        with self.lock:
            document = self._read_custom()
            self._assert_revision(document, expected_revision)
            items = [item for item in document["items"] if item.get("id") != item_id]
            if len(items) == len(document["items"]):
                raise ApiError(HTTPStatus.NOT_FOUND, "未找到该共享美食")
            updated = self._next_document(document, items)
            self._atomic_write(updated)
            return updated


def parse_if_match(value: str | None) -> int | None:
    if value is None:
        return None
    cleaned = value.strip().strip('"')
    try:
        return int(cleaned)
    except ValueError as error:
        raise ApiError(HTTPStatus.BAD_REQUEST, "If-Match revision格式不正确") from error


def create_handler(project_dir: Path, store: FoodStore):
    class RequestHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(project_dir), **kwargs)

        def end_headers(self) -> None:
            if self.path.startswith("/api/"):
                self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def send_json(self, status: int, data: dict) -> None:
            payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def read_json(self) -> object:
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError as error:
                raise ApiError(HTTPStatus.BAD_REQUEST, "Content-Length格式不正确") from error
            if length <= 0:
                raise ApiError(HTTPStatus.BAD_REQUEST, "请求内容不能为空")
            if length > MAX_BODY_BYTES:
                raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "请求内容过大")
            try:
                return json.loads(self.rfile.read(length).decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                raise ApiError(HTTPStatus.BAD_REQUEST, "JSON格式不正确") from error

        def handle_api(self, method: str) -> bool:
            path = unquote(urlparse(self.path).path)
            if not path.startswith("/api/"):
                return False

            try:
                if method == "GET" and path == "/api/health":
                    self.send_json(HTTPStatus.OK, {"ok": True, "data": {"status": "healthy"}})
                    return True
                if method == "GET" and path == "/api/foods":
                    self.send_json(HTTPStatus.OK, {"ok": True, "data": store.get_all()})
                    return True
                if method == "GET" and path == "/api/custom-items":
                    self.send_json(HTTPStatus.OK, {"ok": True, "data": store.get_custom()})
                    return True
                if method == "POST" and path == "/api/custom-items":
                    item, document = store.create(self.read_json())
                    self.send_json(
                        HTTPStatus.CREATED,
                        {
                            "ok": True,
                            "revision": document["revision"],
                            "updatedAt": document["updatedAt"],
                            "data": item,
                        },
                    )
                    return True

                prefix = "/api/custom-items/"
                if path.startswith(prefix) and len(path) > len(prefix):
                    item_id = path[len(prefix):]
                    revision = parse_if_match(self.headers.get("If-Match"))
                    if method == "PUT":
                        item, document = store.update(item_id, self.read_json(), revision)
                        self.send_json(
                            HTTPStatus.OK,
                            {
                                "ok": True,
                                "revision": document["revision"],
                                "updatedAt": document["updatedAt"],
                                "data": item,
                            },
                        )
                        return True
                    if method == "DELETE":
                        document = store.delete(item_id, revision)
                        self.send_json(
                            HTTPStatus.OK,
                            {
                                "ok": True,
                                "revision": document["revision"],
                                "updatedAt": document["updatedAt"],
                                "data": {"id": item_id},
                            },
                        )
                        return True

                raise ApiError(HTTPStatus.NOT_FOUND, "API路径不存在")
            except ApiError as error:
                self.send_json(error.status, {"ok": False, "error": error.message})
                return True
            except Exception as error:
                self.log_error("Unhandled API error: %s", error)
                self.send_json(
                    HTTPStatus.INTERNAL_SERVER_ERROR,
                    {"ok": False, "error": "服务器内部错误"},
                )
                return True

        def do_GET(self) -> None:
            if not self.handle_api("GET"):
                super().do_GET()

        def do_POST(self) -> None:
            if not self.handle_api("POST"):
                self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)

        def do_PUT(self) -> None:
            if not self.handle_api("PUT"):
                self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)

        def do_DELETE(self) -> None:
            if not self.handle_api("DELETE"):
                self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)

    return RequestHandler


def create_server(host: str, port: int, project_dir: Path | None = None) -> ThreadingHTTPServer:
    root = (project_dir or Path(__file__).resolve().parent).resolve()
    store = FoodStore(root / "data" / "foods.json", root / "data" / "custom_items.json")
    return ThreadingHTTPServer((host, port), create_handler(root, store))


def main() -> None:
    parser = argparse.ArgumentParser(description="今天吃什么家庭共享服务")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    server = create_server(args.host, args.port)
    print(f"服务监听 http://{args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
