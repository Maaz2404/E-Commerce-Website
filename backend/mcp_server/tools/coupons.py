"""Coupon tools — list active coupons and validate one for the current user."""
from mcp.server.fastmcp import Context

from mcp_server.client import rest_get, rest_post
from mcp_server.tools._ctx import jwt_from_ctx


def register(mcp):
    @mcp.tool()
    async def list_active_coupons(ctx: Context) -> dict:
        """List currently active coupons (code, discount_type, discount_value, uses_left)."""
        return await rest_get("/coupons/active", jwt_from_ctx(ctx))

    @mcp.tool()
    async def validate_coupon(ctx: Context, code: str, order_total: float | None = None) -> dict:
        """Check whether a coupon code is valid for the user (optionally against an order total)."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_post("/coupons/validate", jwt,
                               json={"code": code, "order_total": order_total})
