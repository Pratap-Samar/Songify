from functools import lru_cache
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from ytmusicapi import YTMusic


class Track(BaseModel):
    video_id: str = Field(serialization_alias="videoId")
    title: str
    artists: list[str]
    album: str | None = None
    duration_ms: int | None = Field(default=None, serialization_alias="durationMs")
    thumbnail_url: str | None = Field(default=None, serialization_alias="thumbnailUrl")


class SearchResponse(BaseModel):
    items: list[Track]


class PlaybackResponse(Track):
    stream_url: str = Field(serialization_alias="streamUrl")
    mime_type: str = Field(serialization_alias="mimeType")
    expires_in_seconds: int | None = Field(
        default=None, serialization_alias="expiresInSeconds"
    )


app = FastAPI(title="Songify API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict this to the deployed mobile app origin before public hosting.
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@lru_cache
def get_ytmusic() -> YTMusic:
    return YTMusic()


def thumbnail_url(item: dict[str, Any]) -> str | None:
    thumbnails = item.get("thumbnails") or []
    for thumbnail in reversed(thumbnails):
        url = thumbnail.get("url")
        if isinstance(url, str):
            return url
    return None


def artist_names(item: dict[str, Any]) -> list[str]:
    artists = item.get("artists") or item.get("artist") or item.get("author") or []
    if isinstance(artists, str):
        return [artists]
    if isinstance(artists, dict):
        artists = [artists]

    names = [artist.get("name") for artist in artists if isinstance(artist, dict)]
    return [name for name in names if isinstance(name, str)] or ["Unknown artist"]


def duration_ms(item: dict[str, Any]) -> int | None:
    seconds = item.get("duration_seconds")
    if isinstance(seconds, (int, float)):
        return int(seconds * 1000)

    duration = item.get("duration")
    if isinstance(duration, (int, float)):
        return int(duration if duration > 1000 else duration * 1000)
    return None


def normalize_track(item: dict[str, Any]) -> Track | None:
    video_id = item.get("videoId")
    title = item.get("title") or item.get("name")
    if not isinstance(video_id, str) or not isinstance(title, str):
        return None

    album = item.get("album")
    if isinstance(album, dict):
        album = album.get("name")

    return Track(
        video_id=video_id,
        title=title,
        artists=artist_names(item),
        album=album if isinstance(album, str) else None,
        duration_ms=duration_ms(item),
        thumbnail_url=thumbnail_url(item),
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/search", response_model=SearchResponse, response_model_by_alias=True)
def search(q: str = Query(min_length=3, max_length=120)) -> SearchResponse:
    try:
        results = get_ytmusic().search(q, filter="songs")
    except Exception as error:
        raise HTTPException(status_code=502, detail="Music search is unavailable") from error

    tracks = [track for item in results if (track := normalize_track(item)) is not None]
    return SearchResponse(items=tracks)


@app.get(
    "/tracks/{video_id}/playback",
    response_model=PlaybackResponse,
    response_model_by_alias=True,
)
def playback(video_id: str) -> PlaybackResponse:
    if not 6 <= len(video_id) <= 32:
        raise HTTPException(status_code=400, detail="Invalid video ID")

    try:
        song = get_ytmusic().get_song(video_id)
    except Exception as error:
        raise HTTPException(status_code=502, detail="Track playback is unavailable") from error

    track = normalize_track(song.get("videoDetails", {}))
    streaming_data = song.get("streamingData") or {}
    formats = streaming_data.get("adaptiveFormats") or []
    audio_formats = [
        audio_format
        for audio_format in formats
        if isinstance(audio_format.get("url"), str)
        and str(audio_format.get("mimeType", "")).startswith("audio/")
    ]
    if track is None or not audio_formats:
        raise HTTPException(status_code=404, detail="No playable audio stream is available")

    selected_format = max(audio_formats, key=lambda audio_format: audio_format.get("bitrate", 0))
    return PlaybackResponse(
        **track.model_dump(),
        stream_url=selected_format["url"],
        mime_type=selected_format["mimeType"],
        expires_in_seconds=int(streaming_data["expiresInSeconds"])
        if str(streaming_data.get("expiresInSeconds", "")).isdigit()
        else None,
    )
