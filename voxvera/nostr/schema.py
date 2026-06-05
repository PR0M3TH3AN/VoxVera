from __future__ import annotations

import json
import re
import urllib.parse
from pathlib import Path
from typing import Any


EVENT_KIND = 30078
PAYLOAD_TYPE = "voxvera_flyer"
PAYLOAD_VERSION = 1
ALLOWED_QR_TARGETS = {"flyer_url", "nostr_event", "content_url"}
CONFIG_FIELDS = {
    "name",
    "folder_name",
    "lang",
    "title",
    "subtitle",
    "headline",
    "content",
    "url_message",
    "url",
    "footer_message",
    "attachment_path",
    "attachment_filename",
}
FIELD_LIMITS = {
    "folder_name": 64,
    "name": 120,
    "title": 80,
    "subtitle": 120,
    "headline": 160,
    "content": 10000,
    "url_message": 240,
    "url": 2048,
    "footer_message": 240,
}
HTML_PATTERN = re.compile(r"<\s*/?\s*[A-Za-z][^>]*>|on[A-Za-z]+\s*=", re.IGNORECASE)
SUPPORTED_LANGS = {
    "ar",
    "de",
    "en",
    "es",
    "fa",
    "fr",
    "he",
    "hi",
    "ja",
    "pt",
    "ru",
    "sw",
    "tr",
    "zh",
}


class NostrValidationError(ValueError):
    """Raised when a Nostr flyer source is unsafe or malformed."""


def load_source_file(path: str | Path) -> dict[str, Any]:
    source_path = Path(path)
    if not source_path.exists():
        raise NostrValidationError(
            "Phase 1 only supports local Nostr event JSON files. "
            "Relay fetching by note/nevent will be added in a later phase."
        )
    try:
        data = json.loads(source_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise NostrValidationError(f"Invalid JSON: {exc.msg}") from exc
    if not isinstance(data, dict):
        raise NostrValidationError("Nostr source must be a JSON object.")
    return data


def validate_event_source(source: dict[str, Any]) -> dict[str, Any]:
    """Validate a Nostr event or direct payload and return the flyer payload."""
    payload = _extract_payload(source)
    _validate_payload(payload)
    return payload


def normalize_event_source(
    source: dict[str, Any],
    defaults: dict[str, Any],
    *,
    folder_name: str | None = None,
    source_identifier: str | None = None,
) -> dict[str, Any]:
    """Return a normal VoxVera config dict from a validated Nostr source."""
    payload = validate_event_source(source)
    config = dict(defaults)

    for key in CONFIG_FIELDS:
        if key in payload:
            config[key] = payload[key]

    if folder_name:
        config["folder_name"] = folder_name

    config["folder_name"] = _slugify_folder_name(str(config.get("folder_name") or "voxvera"))
    config["lang"] = _normalize_lang(str(config.get("lang") or "en"))
    config.setdefault("tear_off_link", "")

    qr_target = payload.get("qr_target", "flyer_url")
    if qr_target == "content_url":
        config["tear_off_link"] = str(config.get("url", ""))
    elif qr_target == "nostr_event" and source_identifier:
        config["tear_off_link"] = source_identifier

    return config


def _extract_payload(source: dict[str, Any]) -> dict[str, Any]:
    if source.get("type") == PAYLOAD_TYPE:
        return source

    if "content" not in source:
        raise NostrValidationError("Nostr event is missing content.")
    if source.get("kind") != EVENT_KIND:
        raise NostrValidationError(f"Nostr event kind must be {EVENT_KIND}.")
    if not _has_tag(source, "t", "voxvera") or not _has_tag(source, "t", "flyer"):
        raise NostrValidationError("Nostr event must include #voxvera and #flyer tags.")
    if not any(tag and tag[0] == "d" and len(tag) > 1 for tag in source.get("tags", [])):
        raise NostrValidationError("Nostr event must include a d tag.")

    content = source["content"]
    if not isinstance(content, str):
        raise NostrValidationError("Nostr event content must be a JSON string.")
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise NostrValidationError(f"Nostr event content is not valid JSON: {exc.msg}") from exc
    if not isinstance(payload, dict):
        raise NostrValidationError("Nostr event content must decode to a JSON object.")
    return payload


def _validate_payload(payload: dict[str, Any]) -> None:
    if payload.get("type") != PAYLOAD_TYPE:
        raise NostrValidationError(f"Payload type must be {PAYLOAD_TYPE}.")
    if payload.get("version") != PAYLOAD_VERSION:
        raise NostrValidationError(f"Payload version must be {PAYLOAD_VERSION}.")

    qr_target = payload.get("qr_target", "flyer_url")
    if qr_target not in ALLOWED_QR_TARGETS:
        raise NostrValidationError(f"Unsupported qr_target: {qr_target}.")

    for key, value in payload.items():
        if key in {"type", "version", "qr_target"}:
            continue
        if key not in CONFIG_FIELDS:
            continue
        if not isinstance(value, str):
            raise NostrValidationError(f"Field {key} must be a string.")
        limit = FIELD_LIMITS.get(key)
        if limit is not None and len(value) > limit:
            raise NostrValidationError(f"Field {key} exceeds {limit} characters.")
        if key != "url" and HTML_PATTERN.search(value):
            raise NostrValidationError(f"Field {key} contains raw HTML.")

    if "folder_name" in payload:
        _slugify_folder_name(payload["folder_name"])
    if "lang" in payload:
        _normalize_lang(payload["lang"])
    if "url" in payload:
        _validate_url(payload["url"])
    if payload.get("attachment_path") or payload.get("attachment_filename"):
        raise NostrValidationError("Attachments are not supported for Nostr flyer events in V1.")


def _has_tag(source: dict[str, Any], name: str, value: str) -> bool:
    tags = source.get("tags", [])
    if not isinstance(tags, list):
        return False
    return any(isinstance(tag, list) and len(tag) >= 2 and tag[0] == name and tag[1] == value for tag in tags)


def _normalize_lang(lang: str) -> str:
    return lang if lang in SUPPORTED_LANGS else "en"


def _slugify_folder_name(folder_name: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9_-]+", "-", folder_name.strip()).strip("-_").lower()
    if not slug:
        slug = "voxvera"
    if len(slug) > FIELD_LIMITS["folder_name"]:
        slug = slug[: FIELD_LIMITS["folder_name"]].rstrip("-_") or "voxvera"
    return slug


def _validate_url(url: str) -> None:
    if not url:
        return
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https", "nostr"}:
        raise NostrValidationError(f"Unsupported URL scheme: {parsed.scheme or '(none)'}.")
    if parsed.scheme in {"http", "https"} and not parsed.netloc:
        raise NostrValidationError("URL must include a host.")
