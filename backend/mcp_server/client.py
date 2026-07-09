"""Authed HTTP bridge from MCP tools to the Flask REST layer.

Golden rule: MCP tools NEVER touch the DB for user-scoped data. They call the
Flask REST endpoints over HTTP carrying the end-user's JWT, so `@token_required`
stays the single authorization choke point and the bot inherits exactly the
user's permissions.
"""
import os
import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5001")


async def rest_get(path: str, jwt: str, params: dict | None = None):
    """Authed GET to the Flask REST layer, forwarding the end-user's JWT."""
    async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=15.0) as client:
        r = await client.get(
            path,
            params=params or {},
            headers={"Authorization": f"Bearer {jwt}"},
        )
        r.raise_for_status()
        return r.json()

# rest_post / rest_patch added in later phases for write actions.
