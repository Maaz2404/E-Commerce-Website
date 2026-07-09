"""Payment read tools — user-scoped, call the Flask REST layer with the JWT."""
from mcp.server.fastmcp import Context

from mcp_server.client import rest_get
from mcp_server.tools._ctx import jwt_from_ctx


def register(mcp):
    @mcp.tool()
    async def get_payments(ctx: Context) -> dict:
        """List the user's wallet payment methods (id, method_type, balance)."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_get("/payments/methods", jwt)

    @mcp.tool()
    async def get_payment_status(ctx: Context, payment_id: int) -> dict:
        """Get one payment's status (status, amount, order_id, created_at)."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_get(f"/payments/{payment_id}/status", jwt)
