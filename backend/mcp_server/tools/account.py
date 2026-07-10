"""Account tools — profile, addresses, password reset. Thin REST wrappers.

Read tools (get_profile/list_addresses) are raw; the write tools
(update_profile/add_address/request_password_reset) are confirmation-gated in
the chat graph.
"""
from mcp.server.fastmcp import Context

from mcp_server.client import rest_get, rest_post, rest_put
from mcp_server.tools._ctx import jwt_from_ctx


def register(mcp):
    @mcp.tool()
    async def get_profile(ctx: Context) -> dict:
        """The user's own profile (id, email, username, role)."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_get("/users/me", jwt)

    @mcp.tool()
    async def update_profile(ctx: Context, changes: dict) -> dict:
        """Update the user's profile. `changes` may include 'username' and/or 'email'."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_put("/users/me", jwt, json=changes)

    @mcp.tool()
    async def list_addresses(ctx: Context) -> dict:
        """List the user's saved shipping addresses."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_get("/addresses", jwt)

    @mcp.tool()
    async def add_address(ctx: Context, line1: str, city: str = "", postal_code: str = "",
                          country: str = "", phone: str = "", label: str = "") -> dict:
        """Add a shipping address for the user."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_post("/addresses", jwt, json={
            "line1": line1, "city": city, "postal_code": postal_code,
            "country": country, "phone": phone, "label": label,
        })

    @mcp.tool()
    async def request_password_reset(ctx: Context) -> dict:
        """Start a password reset for the current user (demo: returns a token)."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_post("/users/password-reset", jwt)
