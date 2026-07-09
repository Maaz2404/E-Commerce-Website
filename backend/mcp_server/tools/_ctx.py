"""Shared helper: pull the caller's bearer token off the MCP HTTP request.

The chat blueprint (MCP client) forwards the end-user's
`Authorization: Bearer <jwt>` header on the MCP connection. Every user-scoped
tool reads it here and threads it into `rest_get`, so `@token_required` on the
Flask side stays the single authorization choke point.
"""
from mcp.server.fastmcp import Context


def jwt_from_ctx(ctx: Context) -> str:
    try:
        request = ctx.request_context.request
        auth = request.headers.get("authorization", "") if request else ""
    except Exception:
        auth = ""
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1]
    return ""
