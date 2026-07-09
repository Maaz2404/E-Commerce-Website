"""Order read tools — user-scoped, call the Flask REST layer with the JWT."""
from mcp.server.fastmcp import Context

from mcp_server.client import rest_get
from mcp_server.tools._ctx import jwt_from_ctx


def register(mcp):
    @mcp.tool()
    async def get_orders(ctx: Context) -> list:
        """List the current user's orders (id, total_amount, status, created_at)."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_get("/orders/", jwt)

    @mcp.tool()
    async def get_order(ctx: Context, order_id: int) -> dict:
        """Get one order with its line items. Returns {order, items}."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_get(f"/orders/{order_id}", jwt)

    @mcp.tool()
    async def get_order_payments(ctx: Context, order_id: int) -> dict:
        """List all payment rows for one of the user's orders (surfaces double charges)."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_get(f"/orders/{order_id}/payments", jwt)
