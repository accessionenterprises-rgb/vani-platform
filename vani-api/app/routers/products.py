"""Agent Products — kiosk showcase catalog."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.db import get_db
from app.middleware.auth import get_tenant_id

router = APIRouter(prefix="/agents", tags=["Products"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class CreateProductRequest(BaseModel):
    name: str
    description: str = ""
    image_url: Optional[str] = None
    keywords: list[str] = []
    sort_order: int = 0


class UpdateProductRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    keywords: Optional[list[str]] = None
    sort_order: Optional[int] = None
    active: Optional[bool] = None


class ProductResponse(BaseModel):
    model_config = {"extra": "ignore"}
    id: str
    agent_id: str
    name: str
    description: str
    image_url: Optional[str]
    keywords: list[str]
    sort_order: int
    active: bool
    created_at: str


def _row(r: dict) -> ProductResponse:
    return ProductResponse(
        id=str(r["id"]),
        agent_id=str(r["agent_id"]),
        name=r["name"],
        description=r["description"] or "",
        image_url=r.get("image_url"),
        keywords=r.get("keywords") or [],
        sort_order=r.get("sort_order", 0),
        active=r.get("active", True),
        created_at=str(r["created_at"]),
    )


def _verify_agent(db, agent_id: str, tenant_id: str):
    result = (
        db.table("agents")
        .select("id")
        .eq("id", agent_id)
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if result.data is None:
        raise HTTPException(status_code=404, detail="Agent not found")


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/{agent_id}/products", response_model=list[ProductResponse])
async def list_products(agent_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    _verify_agent(db, str(agent_id), tenant_id)
    result = (
        db.table("agent_products")
        .select("*")
        .eq("agent_id", str(agent_id))
        .order("sort_order")
        .order("created_at")
        .execute()
    )
    return [_row(r) for r in result.data]


@router.post("/{agent_id}/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(agent_id: UUID, body: CreateProductRequest, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    _verify_agent(db, str(agent_id), tenant_id)
    result = (
        db.table("agent_products")
        .insert({
            "agent_id":    str(agent_id),
            "name":        body.name,
            "description": body.description,
            "image_url":   body.image_url,
            "keywords":    body.keywords,
            "sort_order":  body.sort_order,
        })
        .execute()
    )
    return _row(result.data[0])


@router.patch("/{agent_id}/products/{product_id}", response_model=ProductResponse)
async def update_product(
    agent_id: UUID, product_id: UUID,
    body: UpdateProductRequest,
    tenant_id: str = Depends(get_tenant_id),
):
    db = get_db()
    _verify_agent(db, str(agent_id), tenant_id)

    updates: dict = {}
    if body.name is not None:        updates["name"]        = body.name
    if body.description is not None: updates["description"] = body.description
    if body.image_url is not None:   updates["image_url"]   = body.image_url
    if body.keywords is not None:    updates["keywords"]    = body.keywords
    if body.sort_order is not None:  updates["sort_order"]  = body.sort_order
    if body.active is not None:      updates["active"]      = body.active

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    db.table("agent_products").update(updates).eq("id", str(product_id)).eq("agent_id", str(agent_id)).execute()
    result = (
        db.table("agent_products")
        .select("*")
        .eq("id", str(product_id))
        .single()
        .execute()
    )
    return _row(result.data)


@router.delete("/{agent_id}/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(agent_id: UUID, product_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    _verify_agent(db, str(agent_id), tenant_id)
    db.table("agent_products").delete().eq("id", str(product_id)).eq("agent_id", str(agent_id)).execute()
