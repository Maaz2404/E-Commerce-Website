"""Product read tools — public REST endpoints, JWT forwarded for consistency."""
from mcp.server.fastmcp import Context

from mcp_server.client import rest_get
from mcp_server.tools._ctx import jwt_from_ctx


def register(mcp):
    @mcp.tool()
    async def search_products(ctx: Context, category: str | None = None,
                              search: str | None = None) -> dict:
        """Search products by optional category (exact) and search term (name ILIKE)."""
        params = {k: v for k, v in {"category": category, "search": search}.items() if v}
        return await rest_get("/products/", jwt_from_ctx(ctx), params=params or None)

    @mcp.tool()
    async def get_product(ctx: Context, product_id: int) -> dict:
        """Get one product's full details (name, description, price, stock, category)."""
        return await rest_get(f"/products/{product_id}", jwt_from_ctx(ctx))
