"""FastMCP sidecar (:8900), streamable-HTTP transport.

Phase 1 tools (registered per module under `tools/`):
  orders   : get_orders, get_order, get_order_payments
  products : search_products, get_product
  coupons  : list_active_coupons
  payments : get_payments, get_payment_status
  rag      : search_knowledge_base (the one allowed direct-DB tool)

JWT propagation: the chat blueprint (MCP client) forwards the end-user's
`Authorization: Bearer <jwt>` header on the MCP connection. Each user-scoped
tool receives a `Context` and reads that header from the underlying HTTP
request (see `tools/_ctx.py`), then calls the Flask REST layer over HTTP — it
never touches the DB for user data.
"""
import os
import sys

# Make sibling backend modules (database, client) importable when run as a script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

# Avoid a FAISS/OpenMP conflict on macOS if a native lib is pulled in.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from mcp.server.fastmcp import FastMCP

from mcp_server.tools import orders, products, coupons, payments, rag

mcp = FastMCP("ecommerce", host="0.0.0.0", port=8900)

for mod in (orders, products, coupons, payments, rag):
    mod.register(mcp)


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
