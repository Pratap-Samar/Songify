import os
import re
import time
import asyncio
from functools import lru_cache
from collections import OrderedDict
from typing import Any
import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from yt_dlp import YoutubeDL
from ytmusicapi import YTMusic

# ── CORS configuration ──────────────────────────────────────────────
# During development the web client runs on localhost:8081 or a LAN IP
# (e.g. 192.168.1.42:8081).  Override via the DEV_ALLOWED_ORIGINS env
# var (comma-separated).  In production this MUST be replaced with an
# explicit allow-list — the current regex accepts any origin on the
# local network, which is dangerously permissive for public hosting.
_DEV_ORIGIN_PATTERN = (
    r"^https?://(localhost|127\.0\.0\.1|\[::1])"
    r"(:\d+)?$"
    r"|^https?://(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)"
    r"(:\d+)?$"
)
_DEV_ALLOWED_ORIGINS = os.environ.get(
    "DEV_ALLOWED_ORIGINS",
    "http://localhost:8081,http://127.0.0.1:8081",
).split(",")


def _cors_origin(request: Request) -> str:
    """Return the value for Access-Control-Allow-Origin.

    In development we echo back any origin that matches the local-network
    pattern so that tools (Swagger UI, HMR proxies, etc.) also work.
    In production this would check an explicit allow-list.
    """
    origin = request.headers.get("origin", "")
    if re.match(_DEV_ORIGIN_PATTERN, origin, re.IGNORECASE):
        return origin
    # Fall back to explicit list for non-matching origins
    for allowed in _DEV_ALLOWED_ORIGINS:
        allowed = allowed.strip()
        if allowed == origin or allowed == "*":
            return origin if origin else "*"
    return ""  # empty = disallow


def _cors_headers(request: Request) -> dict[str, str]:
    origin = _cors_origin(request)
    if not origin:
        return {}
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Vary": "Origin",
    }


class Track(BaseModel):
    video_id: str = Field(serialization_alias="videoId")
    title: str
    artists: list[str]
    album: str | None = None
    duration_ms: int | None = Field(default=None, serialization_alias="durationMs")
    thumbnail_url: str | None = Field(default=None, serialization_alias="thumbnailUrl")


class AlbumSearchItem(BaseModel):
    id: str
    title: str
    artists: list[str]
    year: str | None = None
    thumbnail_url: str | None = Field(default=None, serialization_alias="thumbnailUrl")


class SearchResponse(BaseModel):
    songs: list[Track]
    albums: list[AlbumSearchItem]
    videos: list[Track] = []


class AlbumDetails(BaseModel):
    id: str
    title: str
    artists: list[str]
    artwork: str | None = None
    year: str | None = None
    description: str | None = None
    track_count: int | None = Field(default=None, serialization_alias="trackCount")
    duration: str | None = None
    tracks: list[Track]


class PlaybackResponse(Track):
    stream_url: str = Field(serialization_alias="streamUrl")
    mime_type: str = Field(serialization_alias="mimeType")
    expires_in_seconds: int | None = Field(
        default=None, serialization_alias="expiresInSeconds"
    )


app = FastAPI(title="Songify API")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=_DEV_ORIGIN_PATTERN,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return Response(
        status_code=500,
        content='{"detail": "Internal server error"}',
        media_type="application/json",
        headers=_cors_headers(request),
    )


@app.exception_handler(HTTPException)
async def cors_http_exception_handler(request: Request, exc: HTTPException):
    return Response(
        status_code=exc.status_code,
        content=f'{{"detail": "{exc.detail}"}}',
        media_type="application/json",
        headers=_cors_headers(request),
    )


@lru_cache
def get_ytmusic() -> YTMusic:
    return YTMusic()


def resolve_stream_url(video_id: str) -> tuple[str, dict[str, str], dict[str, Any]] | None:
    """Return the compatible progressive format 18 stream, fallback to audio-only if not available."""
    result = _resolve_stream_url(video_id, combined=True)
    if result is not None:
        return result
    return _resolve_stream_url(video_id, combined=False)


def resolve_stream_url_combined(video_id: str) -> tuple[str, dict[str, str], dict[str, Any]] | None:
    """Return (url, headers, format_info) forcing a combined video+audio format.

    Use this when audio-only formats are blocked by YouTube's CDN (403).
    """
    return _resolve_stream_url(video_id, combined=True)


def _resolve_stream_url(
    video_id: str, combined: bool = True
) -> tuple[str, dict[str, str], dict[str, Any]] | None:
    fmt = "18" if combined else "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio"
    try:
        with YoutubeDL({"quiet": True, "no_warnings": True, "format": fmt}) as ydl:
            info = ydl.extract_info(
                f"https://music.youtube.com/watch?v={video_id}", download=False
            )
            formats = info.get("formats") or []
            candidates = [
                f
                for f in formats
                if isinstance(f.get("url"), str) and f.get("acodec") not in (None, "none")
                and (f.get("vcodec") not in (None, "none") if combined else f.get("vcodec") in (None, "none"))
            ]
            if candidates:
                best = max(candidates, key=lambda f: f.get("abr", 0) or 0)
                headers = best.get("http_headers") or info.get("http_headers") or {}
                return best["url"], dict(headers), best

            # Last resort: info-level direct URL
            url = info.get("url")
            if isinstance(url, str):
                headers = info.get("http_headers") or {}
                return url, dict(headers), info
    except Exception:
        pass
    return None


def thumbnail_url(item: dict[str, Any]) -> str | None:
    thumbnails = item.get("thumbnails") or item.get("thumbnail", {}).get("thumbnails") or []
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
async def search(q: str = Query(min_length=3, max_length=120), type: str | None = None) -> SearchResponse:
    try:
        yt = get_ytmusic()
        results_songs, results_albums, results_videos = [], [], []
        if type == "songs":
            results_songs = await run_in_threadpool(yt.search, q, filter="songs")
        elif type == "albums":
            results_albums = await run_in_threadpool(yt.search, q, filter="albums")
        elif type == "videos":
            results_videos = await run_in_threadpool(yt.search, q, filter="videos")
        else:
            results_songs, results_albums, results_videos = await asyncio.gather(
                run_in_threadpool(yt.search, q, filter="songs"),
                run_in_threadpool(yt.search, q, filter="albums"),
                run_in_threadpool(yt.search, q, filter="videos"),
            )
    except Exception as error:
        raise HTTPException(status_code=502, detail="Music search is unavailable") from error

    songs = [track for item in results_songs if (track := normalize_track(item)) is not None]
    videos = [track for item in results_videos if (track := normalize_track(item)) is not None]
    
    albums = []
    for item in results_albums:
        browse_id = item.get("browseId")
        title = item.get("title")
        if not browse_id or not title:
            continue
            
        albums.append(AlbumSearchItem(
            id=browse_id,
            title=title,
            artists=artist_names(item),
            year=item.get("year"),
            thumbnail_url=thumbnail_url(item)
        ))

    return SearchResponse(songs=songs, albums=albums, videos=videos)


@app.get("/albums/{browse_id}", response_model=AlbumDetails, response_model_by_alias=True)
async def get_album(browse_id: str) -> AlbumDetails:
    try:
        album = await run_in_threadpool(get_ytmusic().get_album, browse_id)
    except Exception as error:
        raise HTTPException(status_code=502, detail="Album fetch is unavailable") from error

    artwork = thumbnail_url(album)
    album_title = album.get("title") or "Unknown Album"
    
    tracks = []
    for item in album.get("tracks", []):
        video_id = item.get("videoId")
        title = item.get("title")
        if not video_id or not title:
            continue
            
        tracks.append(Track(
            video_id=video_id,
            title=title,
            artists=artist_names(item) or artist_names(album),
            album=album_title,
            duration_ms=duration_ms(item),
            thumbnail_url=artwork,
        ))

    return AlbumDetails(
        id=browse_id,
        title=album_title,
        artists=artist_names(album),
        artwork=artwork,
        year=album.get("year"),
        description=album.get("description"),
        track_count=album.get("trackCount"),
        duration=album.get("duration"),
        tracks=tracks
    )


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

    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")

    return PlaybackResponse(
        **track.model_dump(),
        stream_url=f"/proxy/audio/{video_id}.mp4",
        mime_type="audio/mp4",
        expires_in_seconds=None,
    )



import logging
import uuid
import sys

logger = logging.getLogger("audio_proxy")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)


@app.get("/proxy/audio/{video_id}/prefetch")
async def prefetch_audio(video_id: str):
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
        raise HTTPException(status_code=400, detail="Invalid video ID")

    # Caching has been disabled for V1 reliability. Prefetch is a no-op.
    return {"cached": False}

@app.get("/resolve/{video_id}")
async def resolve_raw_stream(video_id: str):
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
        raise HTTPException(status_code=400, detail="Invalid video ID")
        
    result = await run_in_threadpool(resolve_stream_url, video_id)
    if result is None:
        raise HTTPException(status_code=404, detail="No compatible stream available")
    stream_url, upstream_headers, _ = result
    return {"url": stream_url, "headers": upstream_headers}

@app.api_route("/proxy/audio/{video_id}", methods=["GET", "HEAD", "OPTIONS"])
async def proxy_audio(video_id: str, request: Request):
    session_id = str(uuid.uuid4())[:8]
    req_start_ts = time.time()
    
    if video_id.endswith(".mp4"):
        video_id = video_id[:-4]

    logger.info(
        "[%s] [START] method=%s video_id=%s range=%s",
        session_id,
        request.method,
        video_id,
        request.headers.get("range"),
    )

    # Validate against YouTube's exact 11-char ID format before doing any work
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
        raise HTTPException(status_code=400, detail="Invalid video ID")

    cors_headers = _cors_headers(request)
    if not cors_headers:
        # Dev fallback — tighten to explicit list before deployment
        cors_headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }

    # ── HEAD / OPTIONS – no body ────────────────────────────────────
    if request.method in ("HEAD", "OPTIONS"):
        return Response(headers={**cors_headers, "Content-Length": "0"})

    # ── Resolve the upstream stream URL ──────────
    result = await run_in_threadpool(resolve_stream_url, video_id)
    if result is None:
        raise HTTPException(status_code=404, detail="No compatible stream available")
    stream_url, upstream_headers, _ = result
    upstream_ct = None
    upstream_cl = None

    # ── Merge client Range header with upstream headers ──────────────
    range_header = request.headers.get("range")
    req_headers: dict[str, str] = dict(upstream_headers)
    if range_header:
        req_headers["Range"] = range_header

    # ── Open upstream connection eagerly to learn response headers ──
    upstream = None
    client = None
    for attempt in range(1):
        if upstream:
            await upstream.aclose()
            if client:
                await client.aclose()
        try:
            client_kwargs: dict[str, Any] = {
                "timeout": httpx.Timeout(connect=5.0, read=30.0, write=30.0, pool=5.0),
                "follow_redirects": True,
            }
            client = httpx.AsyncClient(**client_kwargs)
            req = client.build_request("GET", stream_url, headers=req_headers)
            upstream = await client.send(req, stream=True)
            logger.info(
                "[%s] Upstream response status=%s content_type=%s",
                session_id,
                upstream.status_code,
                upstream.headers.get("content-type"),
            )
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Upstream audio source timed out")
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Failed to fetch audio from upstream")
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Audio proxy error: {type(exc).__name__}") from exc

        check_ct = upstream.headers.get("content-type") or upstream_ct or ""
        is_playable = (
            upstream.status_code == 200 or upstream.status_code == 206
        ) and (
            check_ct.startswith("audio/") or check_ct.startswith("video/")
        )

        if not is_playable:
            raise HTTPException(
                status_code=502,
                detail=f"Upstream returned {upstream.status_code} {upstream_ct} — not playable audio",
            )

        break

    # ── Capture upstream metadata ───────────────────────────────────
    upstream_ct = upstream.headers.get("content-type") or upstream_ct
    
    if upstream.status_code == 200:
        cl_str = upstream.headers.get("content-length")
        upstream_cl = int(cl_str) if cl_str and cl_str.isdigit() else upstream_cl

    # Build Content-Range for 206 responses
    status_code = upstream.status_code
    content_range = None
    if status_code == 206:
        content_range = upstream.headers.get("content-range")

    # ── Response headers ────────────────────────────────────────────
    resp_headers: dict[str, str] = {**cors_headers, "Accept-Ranges": "bytes"}
    if upstream_ct:
        resp_headers["Content-Type"] = upstream_ct

    if status_code == 206:
        chunk_cl = upstream.headers.get("content-length")
        if chunk_cl:
            resp_headers["Content-Length"] = chunk_cl
        if content_range:
            resp_headers["Content-Range"] = content_range
    else:
        if upstream_cl is not None:
            resp_headers["Content-Length"] = str(upstream_cl)

    # ── Stream the upstream body ────────────────────────────────────
    async def stream_generator():
        try:
            async for chunk in upstream.aiter_bytes():
                yield chunk
        except (httpx.ReadError, httpx.RemoteProtocolError):
            return
        finally:
            resp_completed_ts = time.time()
            total_dur = resp_completed_ts - req_start_ts
            logger.info(f"[{session_id}] [END] Request completed. Total time: {total_dur:.4f}s")
            await upstream.aclose()
            if client:
                await client.aclose()

    return StreamingResponse(
        stream_generator(),
        status_code=status_code,
        headers=resp_headers,
    )


# ── Image proxy cache ───────────────────────────────────────────────
from urllib.parse import urlparse

_image_cache: dict[str, tuple[float, bytes, str]] = {}
_IMAGE_CACHE_TTL = 300  # seconds

@app.api_route("/proxy/image", methods=["GET", "HEAD", "OPTIONS"])
async def proxy_image(url: str, request: Request):
    cors_headers = _cors_headers(request)
    if not cors_headers:
        cors_headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }

    if request.method in ("HEAD", "OPTIONS"):
        return Response(headers={**cors_headers, "Content-Length": "0"})
        
    # Validate URL domain
    parsed = urlparse(url)
    if not parsed.hostname or not (
        parsed.hostname.endswith("googleusercontent.com") or 
        parsed.hostname.endswith("ytimg.com") or 
        parsed.hostname.endswith("ggpht.com")
    ):
        raise HTTPException(status_code=403, detail="Domain not allowed")

    # Check cache
    entry = _image_cache.get(url)
    if entry:
        ts, data, content_type = entry
        if time.monotonic() - ts <= _IMAGE_CACHE_TTL:
            return Response(content=data, media_type=content_type, headers=cors_headers)
        else:
            del _image_cache[url]

    # Fetch
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Upstream returned {resp.status_code}")
            
            data = resp.content
            content_type = resp.headers.get("content-type", "image/jpeg")
            
            _image_cache[url] = (time.monotonic(), data, content_type)
            return Response(content=data, media_type=content_type, headers=cors_headers)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Upstream timeout")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Failed to fetch image")
    except Exception:
        raise HTTPException(status_code=500, detail="Image proxy error")
