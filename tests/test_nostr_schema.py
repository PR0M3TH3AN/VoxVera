import json

import pytest

from voxvera.nostr import NostrValidationError, normalize_event_source, validate_event_source


def _payload(**overrides):
    payload = {
        "type": "voxvera_flyer",
        "version": 1,
        "name": "Nostr Flyer",
        "folder_name": "nostr-flyer",
        "lang": "en",
        "title": "NOSTR SOURCE TEST",
        "subtitle": "A static source event",
        "headline": "Publish once, render anywhere",
        "content": "This flyer came from a Nostr event.",
        "url": "https://voxvera.org",
        "tear_off_link": "https://client.example/nostr/?addr=naddr1example",
        "url_message": "Open this poster",
        "footer_message": "share truth",
    }
    payload.update(overrides)
    return payload


def _event(payload=None, **overrides):
    event = {
        "kind": 30078,
        "content": json.dumps(payload or _payload()),
        "tags": [
            ["d", "voxvera:nostr-flyer"],
            ["t", "voxvera"],
            ["t", "flyer"],
            ["language", "en"],
            ["L", "ISO-639-1"],
            ["l", "en", "ISO-639-1"],
        ],
    }
    event.update(overrides)
    return event


def test_validate_accepts_direct_payload():
    assert validate_event_source(_payload())["title"] == "NOSTR SOURCE TEST"


def test_validate_accepts_nostr_event_payload():
    assert validate_event_source(_event())["content"] == "This flyer came from a Nostr event."


def test_validate_accepts_deletion_tombstone():
    # A deleted flyer is replaced (same d-tag) with a minimal tombstone payload
    # carrying deleted: true. It is still a valid voxvera_flyer event.
    tombstone = {
        "type": "voxvera_flyer",
        "version": 1,
        "deleted": True,
        "folder_name": "nostr-flyer",
        "lang": "en",
    }
    event = _event(tombstone, tags=[
        ["d", "voxvera:nostr-flyer"],
        ["t", "voxvera"],
        ["t", "flyer"],
        ["deleted", ""],
        ["language", "en"],
    ])
    payload = validate_event_source(event)
    assert payload["deleted"] is True


def test_validate_uses_language_tag_when_payload_lang_is_missing():
    payload = _payload()
    payload.pop("lang")
    event = _event(payload, tags=[
        ["d", "voxvera:nostr-flyer"],
        ["t", "voxvera"],
        ["t", "flyer"],
        ["language", "es"],
        ["L", "ISO-639-1"],
        ["l", "es", "ISO-639-1"],
    ])

    assert validate_event_source(event)["lang"] == "es"


def test_normalize_maps_to_flyer_config_defaults():
    defaults = {
        "folder_name": "voxvera",
        "lang": "en",
        "tear_off_link": "",
        "url": "",
    }

    config = normalize_event_source(_event(), defaults)

    assert config["folder_name"] == "nostr-flyer"
    assert config["lang"] == "en"
    assert config["url"] == "https://voxvera.org"
    assert config["tear_off_link"] == "https://client.example/nostr/?addr=naddr1example"


def test_normalize_keeps_content_url_separate_from_tear_off_link():
    defaults = {"folder_name": "voxvera", "lang": "en", "tear_off_link": ""}
    event = _event(_payload(
        url="https://creator.example/action",
        tear_off_link="https://client.example/nostr/?addr=naddr1example",
    ))

    config = normalize_event_source(event, defaults)

    assert config["url"] == "https://creator.example/action"
    assert config["tear_off_link"] == "https://client.example/nostr/?addr=naddr1example"


def test_normalize_supports_content_url_qr_target():
    defaults = {"folder_name": "voxvera", "lang": "en", "tear_off_link": ""}
    event = _event(_payload(qr_target="content_url"))

    config = normalize_event_source(event, defaults)

    assert config["tear_off_link"] == "https://voxvera.org"


def test_normalize_supports_nostr_event_qr_target():
    defaults = {"folder_name": "voxvera", "lang": "en", "tear_off_link": ""}
    event = _event(_payload(qr_target="nostr_event"))

    config = normalize_event_source(event, defaults, source_identifier="note1example")

    assert config["tear_off_link"] == "note1example"


def test_validate_rejects_unsafe_url_scheme():
    with pytest.raises(NostrValidationError, match="Unsupported URL scheme"):
        validate_event_source(_payload(url="javascript:alert(1)"))


def test_validate_rejects_raw_html():
    with pytest.raises(NostrValidationError, match="contains raw HTML"):
        validate_event_source(_payload(content="<script>alert(1)</script>"))


def test_validate_rejects_missing_tags():
    with pytest.raises(NostrValidationError, match="#voxvera and #flyer"):
        validate_event_source(_event(tags=[["d", "voxvera:nostr-flyer"]]))


def test_validate_rejects_attachments():
    with pytest.raises(NostrValidationError, match="Attachments are not supported"):
        validate_event_source(_payload(attachment_path="file.zip"))
