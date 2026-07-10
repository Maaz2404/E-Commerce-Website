"""Support ticket tools — thin REST wrappers, user-scoped via JWT.

`create_ticket`/`upload_attachment` need no confirmation gate (opening a ticket
is not destructive); they are handed to the Support agent directly. The widget's
image-upload uses the direct multipart POST /tickets path — `upload_attachment`
is the fallback for when the model itself carries the image bytes.
"""
from mcp.server.fastmcp import Context

from mcp_server.client import rest_get, rest_post_multipart
from mcp_server.tools._ctx import jwt_from_ctx


def register(mcp):
    @mcp.tool()
    async def create_ticket(ctx: Context, subject: str, category: str = "other",
                            description: str = "", chat_id: int | None = None) -> dict:
        """Open a support ticket (no attachment). Used by the escalation flow."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        data = {"subject": subject, "category": category, "description": description}
        if chat_id:
            data["chat_id"] = chat_id
        return await rest_post_multipart("/tickets", jwt, data=data)

    @mcp.tool()
    async def upload_attachment(ctx: Context, subject: str, category: str,
                                filename: str, content_b64: str) -> dict:
        """Open a ticket with an image attachment (e.g. a damaged-item photo).

        `content_b64` is the base64-encoded file bytes."""
        import base64
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_post_multipart(
            "/tickets", jwt,
            data={"subject": subject, "category": category},
            files={"attachment": (filename, base64.b64decode(content_b64))},
        )

    @mcp.tool()
    async def get_tickets(ctx: Context) -> dict:
        """List the user's support tickets."""
        jwt = jwt_from_ctx(ctx)
        if not jwt:
            return {"error": "missing authorization"}
        return await rest_get("/tickets", jwt)
