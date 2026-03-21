"""
Tool executor — called by the LLM during a live conversation.

The LLM returns a tool_call → executor calls the tool URL → returns result.
Engine injects result back into LLM context for the final response.

Tool schema stored in DB:
  { name, description, method, url, headers, params_schema }

LLM sees the tool as a function:
  { "name": "check_availability", "description": "...", "parameters": <params_schema> }
"""
import json
import os
from typing import Any

import httpx
import structlog

logger = structlog.get_logger()

TOOL_TIMEOUT = 8   # seconds — must be fast or caller hears silence


async def execute_tool(
    tool: dict,
    arguments: dict,
    call_id: str = "",
    tenant_id: str = "",
    call_context: dict | None = None,
) -> str:
    url     = tool.get("url", "")
    method  = (tool.get("method") or "POST").upper()
    headers = dict(tool.get("headers") or {})

    if not url:
        return "Error: tool has no URL configured"

    payload = {
        **arguments,
        "_vani": {
            "call_id":   call_id,
            "tenant_id": tenant_id,
            **(call_context or {}),
        },
    }

    if "Content-Type" not in headers:
        headers["Content-Type"] = "application/json"

    log = logger.bind(tool=tool.get("name"), call_id=call_id)
    log.info("tool_executing", url=url, method=method)

    try:
        async with httpx.AsyncClient(timeout=TOOL_TIMEOUT) as client:
            if method in ("GET", "DELETE"):
                resp = await client.request(method, url, params={k: v for k, v in arguments.items()}, headers=headers)
            else:
                resp = await client.request(method, url, json=payload, headers=headers)

        log.info("tool_executed", status=resp.status_code)

        if resp.status_code >= 400:
            return f"Error {resp.status_code}: {resp.text[:200]}"

        try:
            result = resp.json()
            return json.dumps(result, ensure_ascii=False)
        except Exception:
            return resp.text[:500]

    except httpx.TimeoutException:
        log.error("tool_timeout", url=url)
        return "Sorry, that request timed out. I'll note that and continue."
    except Exception as e:
        log.error("tool_error", error=str(e))
        return f"Tool call failed: {str(e)[:100]}"


def build_livekit_tools(tool_configs: list[dict]) -> list[dict]:
    tools = []
    for t in tool_configs:
        if not t.get("active", True):
            continue
        tools.append({
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t.get("params_schema") or {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            },
        })
    return tools


def build_product_tools(products: list[dict]) -> list[dict]:
    """
    Built-in __show_product / __clear_product schemas.
    Handled natively in the engine via LiveKit data channel — no HTTP call.
    """
    if not products:
        return []

    product_names = ", ".join(f'"{p["name"]}"' for p in products)

    return [
        {
            "type": "function",
            "function": {
                "name": "__show_product",
                "description": (
                    "Display a product on the kiosk screen when you start explaining or discussing it. "
                    "Call this as soon as you begin talking about a specific product. "
                    f"Available products: {product_names}"
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "product_name": {
                            "type": "string",
                            "description": "Exact name of the product to display",
                        }
                    },
                    "required": ["product_name"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "__clear_product",
                "description": (
                    "Clear the product display and return to full avatar mode "
                    "when the conversation moves away from a specific product."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            },
        },
    ]


async def load_agent_products(agent_id: str) -> list[dict]:
    """Load active products for an agent from Supabase."""
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "")

    if not supabase_url or not supabase_key:
        return []

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{supabase_url}/rest/v1/agent_products",
                params={
                    "agent_id": f"eq.{agent_id}",
                    "active":   "eq.true",
                    "select":   "*",
                    "order":    "sort_order.asc",
                },
                headers={
                    "apikey":        supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                },
            )
            if resp.status_code == 200:
                return resp.json() or []
    except Exception as e:
        logger.warning("load_products_failed", agent_id=agent_id, error=str(e))

    return []


async def load_agent_tools(agent_id: str) -> list[dict]:
    """Load active tools for an agent from Supabase."""
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "")

    if not supabase_url or not supabase_key:
        return []

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{supabase_url}/rest/v1/agent_tools",
                params={"agent_id": f"eq.{agent_id}", "active": "eq.true", "select": "*"},
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                },
            )
            if resp.status_code == 200:
                return resp.json() or []
    except Exception as e:
        logger.warning("load_tools_failed", agent_id=agent_id, error=str(e))

    return []
