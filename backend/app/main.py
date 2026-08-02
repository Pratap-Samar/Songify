import os
import re
import time
from functools import lru_cache
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


def resolve_stream_url(video_id: str) -> tuple[str, dict[str, str]] | None:
    """Return (url, headers) for the best available stream."""
    return _resolve_stream_url(video_id, combined=False)


def resolve_stream_url_combined(video_id: str) -> tuple[str, dict[str, str]] | None:
    """Return (url, headers) forcing a combined video+audio format.

    Use this when audio-only formats are blocked by YouTube's CDN (403).
    """
    return _resolve_stream_url(video_id, combined=True)


def _resolve_stream_url(
    video_id: str, combined: bool = False
) -> tuple[str, dict[str, str]] | None:
    fmt = "18" if combined else "bestaudio/best"
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
                and (f.get("vcodec") not in (None, "none") if combined else True)
            ]
            if candidates:
                best = max(candidates, key=lambda f: f.get("abr", 0) or 0)
                headers = best.get("http_headers") or info.get("http_headers") or {}
                return best["url"], dict(headers)

            # Last resort: info-level direct URL
            url = info.get("url")
            if isinstance(url, str):
                headers = info.get("http_headers") or {}
                return url, dict(headers)
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

    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")

    resolved = resolve_stream_url(video_id)
    if resolved is None:
        raise HTTPException(status_code=404, detail="No playable audio stream is available")

    return PlaybackResponse(
        **track.model_dump(),
        stream_url=f"/proxy/audio/{video_id}",
        mime_type="audio/mp4",
        expires_in_seconds=None,
    )


# ── Resolved-stream URL cache ──────────────────────────────────────
# Key: video_id.  Value: (timestamp, resolved_url, content_type, content_length)
# Keeps yt-dlp resolutions hot for 5 minutes so Range-seek requests
# during playback don't re-trigger a full extraction.
_stream_cache: dict[
    str, tuple[float, str, dict[str, str], str | None, int | None]
] = {}
_STREAM_CACHE_TTL = 300  # seconds


def _get_cached(
    video_id: str,
) -> tuple[str, dict[str, str], str | None, int | None] | None:
    entry = _stream_cache.get(video_id)
    if entry is None:
        return None
    ts, url, headers, ct, cl = entry
    if time.monotonic() - ts > _STREAM_CACHE_TTL:
        del _stream_cache[video_id]
        return None
    return url, headers, ct, cl


def _set_cached(
    video_id: str,
    url: str,
    headers: dict[str, str],
    ct: str | None,
    cl: int | None,
) -> None:
    _stream_cache[video_id] = (time.monotonic(), url, headers, ct, cl)


# When this endpoint is live, revert `resolveAudioUrl` in lib/track-player.ts
# to just `audio.src = proxyUrl; audio.crossOrigin = 'anonymous'` instead of
# the current fetch-then-createObjectURL workaround.  Blob URLs defeat Range-
# based seeking, so the proxy must be called directly for byte-range support.


@app.api_route("/proxy/audio/{video_id}", methods=["GET", "HEAD", "OPTIONS"])
async def proxy_audio(video_id: str, request: Request):
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

    # ── Resolve the upstream stream URL (cached for 5 min) ──────────
    cached = _get_cached(video_id)
    if cached is not None:
        stream_url, upstream_headers, upstream_ct, upstream_cl = cached
    else:
        result = await run_in_threadpool(resolve_stream_url, video_id)
        if result is None:
            raise HTTPException(status_code=404, detail="No audio stream available")
        stream_url, upstream_headers = result
        upstream_ct = None
        upstream_cl = None
        _set_cached(video_id, stream_url, upstream_headers, upstream_ct, upstream_cl)

    # ── Merge client Range header with upstream headers ──────────────
    range_header = request.headers.get("range")
    req_headers: dict[str, str] = dict(upstream_headers)
    if range_header:
        req_headers["Range"] = range_header

    # ── Open upstream connection eagerly to learn response headers ──
    # May loop once if the upstream URL turns out to be blocked (403)
    # and we need to fall back to a combined (video+audio) format.
    upstream = None
    client = None
    for attempt in range(2):
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
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Upstream audio source timed out")
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Failed to fetch audio from upstream")
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Audio proxy error: {type(exc).__name__}") from exc

        check_ct = upstream.headers.get("content-type") or ""
        is_playable = (
            upstream.status_code == 200 or upstream.status_code == 206
        ) and (
            check_ct.startswith("audio/") or check_ct.startswith("video/")
        )

        # If upstream returns 403, YouTube may be blocking audio-only.
        # Re-resolve forcing a combined video+audio format on the next attempt.
        if upstream.status_code == 403 and attempt == 0:
            result = await run_in_threadpool(resolve_stream_url_combined, video_id)
            if result is None:
                raise HTTPException(status_code=502, detail="Upstream rejected request and no fallback format available")
            stream_url, upstream_headers = result
            req_headers = dict(upstream_headers)
            if range_header:
                req_headers["Range"] = range_header
            continue

        if not is_playable:
            raise HTTPException(
                status_code=502,
                detail=f"Upstream returned {upstream.status_code} {upstream_ct} — not playable audio",
            )

        break

    # ── Capture upstream metadata ───────────────────────────────────
    upstream_ct = upstream.headers.get("content-type") or upstream_ct
    cl_str = upstream.headers.get("content-length")
    upstream_cl = int(cl_str) if cl_str and cl_str.isdigit() else upstream_cl
    _set_cached(video_id, stream_url, upstream_headers, upstream_ct, upstream_cl)

    # Build Content-Range for 206 responses
    content_range: str | None = None
    status_code = 200
    if range_header and upstream_cl is not None:
        status_code = 206
        upstream_cr = upstream.headers.get("content-range")
        if upstream_cr:
            content_range = upstream_cr
        else:
            match = re.match(r"bytes=(\d*)-(\d*)", range_header)
            if match:
                start = match.group(1) or "0"
                end = match.group(2) or str(upstream_cl - 1)
                content_range = f"bytes {start}-{end}/{upstream_cl}"

    # ── Response headers ────────────────────────────────────────────
    resp_headers: dict[str, str] = {**cors_headers, "Accept-Ranges": "bytes"}
    if upstream_ct:
        resp_headers["Content-Type"] = upstream_ct
    if upstream_cl is not None:
        resp_headers["Content-Length"] = str(upstream_cl)
    if content_range:
        resp_headers["Content-Range"] = content_range

    # ── Stream the upstream body ────────────────────────────────────
    async def stream():
        try:
            async for chunk in upstream.aiter_bytes():
                yield chunk
        except (httpx.ReadError, httpx.RemoteProtocolError):
            # Connection dropped mid-stream — client can retry via Range.
            # Yield nothing more and let the response end cleanly.
            return
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(
        stream(),
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
