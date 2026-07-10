"""Order tools — user-scoped, call the Flask REST layer with the JWT.

Read tools (get_orders/get_order/get_order_payments) are handed to agents raw.
The write tools (cancel_order/modify_order) are, in the chat graph, wrapped by a
confirmation gate before an agent may fire them (see routes/chat.py) — the MCP
tool itself is a thin REST wrapper and does the actual mutation."""
from mcp.server.fastmcp import Context

from mcp_server.client import rest_get, rest_post, rest_patch
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

    @mcp.tool()
    async def cancel_order(ctx: Context, order_id: int) -> dict:
        """Cancel one of the user's own orders (only allowed pre-shipment)."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_post(f"/orders/{order_id}/cancel", jwt)

    @mcp.tool()
    async def modify_order(ctx: Context, order_id: int, changes: dict) -> dict:
        """Modify a pending/paid order. `changes` is a dict of fields to update."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_patch(f"/orders/{order_id}", jwt, json=changes)
