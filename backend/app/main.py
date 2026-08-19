import os
import re
import time
import asyncio
from functools import lru_cache
from typing import Any
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from yt_dlp import YoutubeDL
import logging
import uuid
import sys

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
    origin = request.headers.get("origin", "")
    if re.match(_DEV_ORIGIN_PATTERN, origin, re.IGNORECASE):
        return origin
    for allowed in _DEV_ALLOWED_ORIGINS:
        allowed = allowed.strip()
        if allowed == origin or allowed == "*":
            return origin if origin else "*"
    return ""


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


app = FastAPI(title="Songify API Fallback")
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


def resolve_stream_url(video_id: str) -> tuple[str, dict[str, str], dict[str, Any]] | None:
    result = _resolve_stream_url(video_id, combined=True)
    if result is not None:
        return result
    return _resolve_stream_url(video_id, combined=False)


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

            url = info.get("url")
            if isinstance(url, str):
                headers = info.get("http_headers") or {}
                return url, dict(headers), info
    except Exception:
        pass
    return None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


logger = logging.getLogger("audio_proxy")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)


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

    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
        raise HTTPException(status_code=400, detail="Invalid video ID")

    cors_headers = _cors_headers(request)
    if not cors_headers:
        cors_headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }

    if request.method in ("HEAD", "OPTIONS"):
        return Response(headers={**cors_headers, "Content-Length": "0"})

    result = await run_in_threadpool(resolve_stream_url, video_id)
    if result is None:
        raise HTTPException(status_code=404, detail="No compatible stream available")
    stream_url, upstream_headers, _ = result
    upstream_ct = None
    upstream_cl = None

    range_header = request.headers.get("range")
    req_headers: dict[str, str] = dict(upstream_headers)
    if range_header:
        req_headers["Range"] = range_header

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

    upstream_ct = upstream.headers.get("content-type") or upstream_ct
    
    if upstream.status_code == 200:
        cl_str = upstream.headers.get("content-length")
        upstream_cl = int(cl_str) if cl_str and cl_str.isdigit() else upstream_cl

    status_code = upstream.status_code
    content_range = None
    if status_code == 206:
        content_range = upstream.headers.get("content-range")

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
