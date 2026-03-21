"""Knowledge base endpoints — upload txt/pdf, list, delete."""
import io
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.db import get_db
from app.middleware.auth import get_tenant_id

router = APIRouter(prefix="/agents/{agent_id}/kb", tags=["knowledge-base"])


class KBDocResponse(BaseModel):
    id: str
    agent_id: str
    filename: str
    content_preview: str   # first 200 chars
    created_at: str


def _row_to_doc(row: dict) -> KBDocResponse:
    return KBDocResponse(
        id=str(row["id"]),
        agent_id=str(row["agent_id"]),
        filename=row["filename"],
        content_preview=row["content"][:200] + ("…" if len(row["content"]) > 200 else ""),
        created_at=str(row["created_at"]),
    )


def _extract_text(file: UploadFile, raw: bytes) -> str:
    name = (file.filename or "").lower()

    if name.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(raw))
            return "\n\n".join(page.extract_text() or "" for page in reader.pages).strip()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not parse PDF: {e}")

    # Plain text (txt, md, csv, etc.)
    try:
        return raw.decode("utf-8").strip()
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 text or PDF")


def _verify_agent_ownership(agent_id: UUID, tenant_id: str) -> None:
    db = get_db()
    row = (
        db.table("agents")
        .select("id")
        .eq("id", str(agent_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if row.data is None:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.get("", response_model=list[KBDocResponse])
async def list_kb(agent_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    _verify_agent_ownership(agent_id, tenant_id)
    db = get_db()
    result = (
        db.table("agent_kb")
        .select("*")
        .eq("agent_id", str(agent_id))
        .order("created_at", desc=True)
        .execute()
    )
    return [_row_to_doc(r) for r in result.data]


@router.post("", response_model=KBDocResponse, status_code=status.HTTP_201_CREATED)
async def upload_kb(
    agent_id: UUID,
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_tenant_id),
):
    _verify_agent_ownership(agent_id, tenant_id)

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    raw = await file.read()
    if len(raw) > 5 * 1024 * 1024:  # 5 MB limit
        raise HTTPException(status_code=400, detail="File too large (max 5 MB)")

    content = _extract_text(file, raw)
    if not content:
        raise HTTPException(status_code=400, detail="File appears to be empty")

    db = get_db()
    result = (
        db.table("agent_kb")
        .insert({
            "agent_id": str(agent_id),
            "tenant_id": tenant_id,
            "filename": file.filename,
            "content": content,
        })
        .execute()
    )
    return _row_to_doc(result.data[0])


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kb(agent_id: UUID, doc_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    _verify_agent_ownership(agent_id, tenant_id)
    db = get_db()

    existing = (
        db.table("agent_kb")
        .select("id")
        .eq("id", str(doc_id))
        .eq("agent_id", str(agent_id))
        .maybe_single()
        .execute()
    )
    if existing.data is None:
        raise HTTPException(status_code=404, detail="Document not found")

    db.table("agent_kb").delete().eq("id", str(doc_id)).execute()
