"""Returns / exchanges tools — thin REST wrappers, user-scoped via JWT.

`create_return` is confirmation-gated in the chat graph; the read tools are raw.
"""
from mcp.server.fastmcp import Context

from mcp_server.client import rest_get, rest_post
from mcp_server.tools._ctx import jwt_from_ctx


def register(mcp):
    @mcp.tool()
    async def create_return(ctx: Context, order_id: int, type: str = "return",
                            reason: str = "") -> dict:
        """File a return or exchange for one of the user's orders.

        `type` is 'return' or 'exchange'."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_post("/returns", jwt,
                               json={"order_id": order_id, "type": type, "reason": reason})

    @mcp.tool()
    async def get_returns(ctx: Context) -> dict:
        """List the user's returns/exchanges and their status."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_get("/returns", jwt)

    @mcp.tool()
    async def get_return_status(ctx: Context, return_id: int) -> dict:
        """Status of a single return/exchange."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_get(f"/returns/{return_id}", jwt)
