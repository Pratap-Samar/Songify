from app.main import normalize_track


def test_normalize_track_maps_ytmusic_song_data() -> None:
    track = normalize_track(
        {
            "videoId": "abc123def45",
            "title": "Example Song",
            "artists": [{"name": "Example Artist"}],
            "album": {"name": "Example Album"},
            "duration_seconds": 180,
            "thumbnails": [{"url": "https://example.com/art-small"}, {"url": "https://example.com/art"}],
        }
    )

    assert track is not None
    assert track.video_id == "abc123def45"
    assert track.artists == ["Example Artist"]
    assert track.album == "Example Album"
    assert track.duration_ms == 180000
    assert track.thumbnail_url == "https://example.com/art"


def test_normalize_track_ignores_non_track_results() -> None:
    assert normalize_track({"title": "Artist result"}) is None
