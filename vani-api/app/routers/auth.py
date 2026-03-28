"""Auth endpoints: signup, login, me."""
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.config import settings
from app.db import get_db
from app.middleware.auth import get_tenant_id

router = APIRouter(prefix="/auth", tags=["Authentication"])

_AUTH_URL = f"{settings.supabase_url}/auth/v1"
_HEADERS = {"apikey": settings.supabase_service_key}


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    tenant_id: str


class MeResponse(BaseModel):
    model_config = {"extra": "ignore"}
    id: str
    name: str
    email: str
    plan: str


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest):
    # Create user via admin API — bypasses email confirmation + rate limits
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{_AUTH_URL}/admin/users",
            headers={**_HEADERS, "Authorization": f"Bearer {settings.supabase_service_key}"},
            json={"email": body.email, "password": body.password, "email_confirm": True},
        )
    if r.status_code not in (200, 201):
        detail = r.json().get("msg") or r.json().get("message") or r.text
        raise HTTPException(status_code=400, detail=detail)

    user = r.json()
    user_id = user["id"]

    # Create tenant row
    db = get_db()
    try:
        db.table("tenants").insert({
            "id": user_id,
            "name": body.name,
            "email": body.email,
            "plan": "starter",
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create tenant: {e}")

    # Sign in to get tokens
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{_AUTH_URL}/token?grant_type=password",
            headers=_HEADERS,
            json={"email": body.email, "password": body.password},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=400, detail="Signup succeeded but login failed — try logging in")

    data = r.json()
    return AuthResponse(
        access_token=data["access_token"],
        refresh_token=data["refresh_token"],
        tenant_id=user_id,
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{_AUTH_URL}/token?grant_type=password",
            headers=_HEADERS,
            json={"email": body.email, "password": body.password},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    data = r.json()
    return AuthResponse(
        access_token=data["access_token"],
        refresh_token=data["refresh_token"],
        tenant_id=data["user"]["id"],
    )


@router.get("/me", response_model=MeResponse)
async def me(tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    row = db.table("tenants").select("*").eq("id", tenant_id).maybe_single().execute()
    if row.data is None:
        # Auto-provision tenant for OAuth users (first login via Google)
        # Fetch user info from Supabase auth
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"{_AUTH_URL}/admin/users/{tenant_id}",
                    headers={**_HEADERS, "Authorization": f"Bearer {settings.supabase_service_key}"},
                )
            if r.status_code == 200:
                user_data = r.json()
                email = user_data.get("email", "")
                name = user_data.get("user_metadata", {}).get("full_name") or email.split("@")[0]
                db.table("tenants").insert({
                    "id": tenant_id,
                    "name": name,
                    "email": email,
                    "plan": "starter",
                }).execute()
                row = db.table("tenants").select("*").eq("id", tenant_id).maybe_single().execute()
                if row.data:
                    return MeResponse(**row.data)
        except Exception:
            pass
        raise HTTPException(status_code=404, detail="Tenant not found")
    return MeResponse(**row.data)
