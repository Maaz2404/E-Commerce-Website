"""Coupon read tool — lists currently active coupons."""
from mcp.server.fastmcp import Context

from mcp_server.client import rest_get
from mcp_server.tools._ctx import jwt_from_ctx


def register(mcp):
    @mcp.tool()
    async def list_active_coupons(ctx: Context) -> dict:
        """List currently active coupons (code, discount_type, discount_value, uses_left)."""
        return await rest_get("/coupons/active", jwt_from_ctx(ctx))
