"""Authed HTTP bridge from MCP tools to the Flask REST layer.

Golden rule: MCP tools NEVER touch the DB for user-scoped data. They call the
Flask REST endpoints over HTTP carrying the end-user's JWT, so `@token_required`
stays the single authorization choke point and the bot inherits exactly the
user's permissions.
"""
import os
import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5001")


def _headers(jwt: str) -> dict:
    return {"Authorization": f"Bearer {jwt}"} if jwt else {}


def _unwrap(r: httpx.Response):
    """Return the JSON body, or a structured error the LLM can read and relay.

    Returning `{"error": ..., "status": ...}` on 4xx/5xx (rather than raising)
    lets the agent explain the failure to the user (e.g. "that order is already
    shipped, so it can't be cancelled") instead of the stream dying.
    """
    try:
        body = r.json()
    except Exception:
        body = {"raw": r.text}
    if r.status_code >= 400:
        return {"error": body, "status": r.status_code}
    return body


async def rest_get(path: str, jwt: str, params: dict | None = None):
    """Authed GET to the Flask REST layer, forwarding the end-user's JWT."""
    async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=15.0) as client:
        r = await client.get(path, params=params or {}, headers=_headers(jwt))
        return _unwrap(r)


async def rest_post(path: str, jwt: str, json: dict | None = None):
    """Authed POST (JSON body) to the Flask REST layer."""
    async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=20.0) as client:
        r = await client.post(path, headers=_headers(jwt), json=json)
        return _unwrap(r)


async def rest_patch(path: str, jwt: str, json: dict | None = None):
    """Authed PATCH (JSON body) to the Flask REST layer."""
    async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=20.0) as client:
        r = await client.patch(path, headers=_headers(jwt), json=json)
        return _unwrap(r)


async def rest_put(path: str, jwt: str, json: dict | None = None):
    """Authed PUT (JSON body) to the Flask REST layer."""
    async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=20.0) as client:
        r = await client.put(path, headers=_headers(jwt), json=json)
        return _unwrap(r)


async def rest_post_multipart(path: str, jwt: str, data: dict | None = None,
                              files: dict | None = None):
    """Authed multipart POST (form fields + file uploads) to the Flask REST layer."""
    async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=30.0) as client:
        r = await client.post(path, headers=_headers(jwt), data=data or {}, files=files)
        return _unwrap(r)
