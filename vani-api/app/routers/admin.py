"""Admin API — platform operator endpoints.

Auth: POST /admin/auth with { "email": ..., "password": ... } → { "token": <jwt> }
All other /admin/* routes require: Authorization: Bearer <admin_token>

Admin users are stored in the admin_users table (bcrypt password hashes).
Superadmins can manage other admins. Admins can use all platform features.

Bootstrap: use ADMIN_BOOTSTRAP_EMAIL + ADMIN_BOOTSTRAP_PASSWORD env vars to
auto-create the first superadmin on startup (runs once, idempotent).
"""
import time
from typing import Optional

import bcrypt
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from app.config import settings
from app.db import get_db

router = APIRouter(prefix="/admin", tags=["admin"])
bearer = HTTPBearer(auto_error=False)

_ALGORITHM = "HS256"
_TOKEN_TTL = 60 * 60 * 12  # 12 hours


# ─── Admin Auth ───────────────────────────────────────────────────────────────

def _make_token(admin_id: str, role: str, name: str) -> str:
    payload = {
        "sub": admin_id,
        "role": role,
        "name": name,
        "iat": int(time.time()),
        "exp": int(time.time()) + _TOKEN_TTL,
    }
    return jwt.encode(payload, settings.admin_secret, algorithm=_ALGORITHM)


def _verify_token(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    if creds is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing admin token")
    try:
        payload = jwt.decode(creds.credentials, settings.admin_secret, algorithms=[_ALGORITHM])
        if payload.get("role") not in ("admin", "superadmin"):
            raise ValueError
        return payload
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token")


def _require_superadmin(payload: dict = Depends(_verify_token)) -> dict:
    if payload.get("role") != "superadmin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Superadmin required")
    return payload


class AuthRequest(BaseModel):
    email: str
    password: str


class CreateAdminRequest(BaseModel):
    email: str
    password: str
    name: str = ""
    role: str = "admin"  # 'admin' | 'superadmin'


@router.post("/auth")
def admin_login(body: AuthRequest):
    db = get_db()
    row = db.table("admin_users").select("*").eq("email", body.email.lower().strip()).eq("active", True).maybe_single().execute()
    if row.data is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    user = row.data
    if not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    # Update last_login
    db.table("admin_users").update({"last_login": time.strftime("%Y-%m-%dT%H:%M:%SZ")}).eq("id", user["id"]).execute()

    token = _make_token(user["id"], user["role"], user.get("name") or user["email"])
    return {"token": token, "name": user.get("name") or user["email"], "role": user["role"]}


@router.get("/auth/me", dependencies=[Depends(_verify_token)])
def admin_me(payload: dict = Depends(_verify_token)):
    return {"id": payload["sub"], "name": payload["name"], "role": payload["role"]}


# ─── Admin User Management (superadmin only) ──────────────────────────────────

@router.get("/admins", dependencies=[Depends(_require_superadmin)])
def list_admins():
    db = get_db()
    rows = db.table("admin_users").select("id, email, name, role, active, last_login, created_at").order("created_at", desc=True).execute()
    return rows.data or []


@router.post("/admins", dependencies=[Depends(_require_superadmin)], status_code=201)
def create_admin(body: CreateAdminRequest):
    db = get_db()
    existing = db.table("admin_users").select("id").eq("email", body.email.lower().strip()).maybe_single().execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already exists")
    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    result = db.table("admin_users").insert({
        "email": body.email.lower().strip(),
        "password_hash": hashed,
        "name": body.name,
        "role": body.role if body.role in ("admin", "superadmin") else "admin",
        "active": True,
    }).execute()
    row = result.data[0]
    return {"id": row["id"], "email": row["email"], "name": row["name"], "role": row["role"]}


@router.patch("/admins/{admin_id}", dependencies=[Depends(_require_superadmin)])
def update_admin(admin_id: str, body: dict):
    db = get_db()
    allowed = {k: v for k, v in body.items() if k in ("name", "role", "active")}
    if "password" in body:
        allowed["password_hash"] = bcrypt.hashpw(body["password"].encode(), bcrypt.gensalt()).decode()
    if not allowed:
        raise HTTPException(status_code=400, detail="Nothing to update")
    db.table("admin_users").update(allowed).eq("id", admin_id).execute()
    return {"ok": True}


@router.delete("/admins/{admin_id}", dependencies=[Depends(_require_superadmin)])
def delete_admin(admin_id: str, payload: dict = Depends(_require_superadmin)):
    if admin_id == payload["sub"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db = get_db()
    db.table("admin_users").delete().eq("id", admin_id).execute()
    return {"ok": True}


@router.post("/bootstrap", status_code=201)
def bootstrap_admin(body: CreateAdminRequest):
    """
    Create the first superadmin. Only works when no admin users exist.
    Call this once after running the 009_admin_users.sql migration.
    """
    db = get_db()
    existing = db.table("admin_users").select("id").limit(1).execute()
    if existing.data:
        raise HTTPException(status_code=403, detail="Admin users already exist. Use /admin/admins to add more.")
    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    result = db.table("admin_users").insert({
        "email": body.email.lower().strip(),
        "password_hash": hashed,
        "name": body.name or "Superadmin",
        "role": "superadmin",
        "active": True,
    }).execute()
    row = result.data[0]
    token = _make_token(row["id"], "superadmin", row.get("name") or row["email"])
    return {"token": token, "name": row.get("name"), "role": "superadmin", "message": "Superadmin created"}


# ─── Platform Stats ───────────────────────────────────────────────────────────

@router.get("/stats", dependencies=[Depends(_verify_token)])
def platform_stats():
    db = get_db()
    tenants = db.table("tenants").select("id, active, plan, created_at").execute()
    agents = db.table("agents").select("id, active").execute()
    calls = db.table("calls").select("id, status, duration_sec, created_at").execute()

    tenant_rows = tenants.data or []
    agent_rows = agents.data or []
    call_rows = calls.data or []

    active_calls = [c for c in call_rows if c.get("status") in ("active", "connecting", "routing")]
    today = time.strftime("%Y-%m-%d")
    calls_today = [c for c in call_rows if (c.get("created_at") or "").startswith(today)]
    total_duration = sum(c.get("duration_sec") or 0 for c in call_rows if c.get("status") == "completed")

    plan_breakdown = {}
    for t in tenant_rows:
        plan = t.get("plan", "starter")
        plan_breakdown[plan] = plan_breakdown.get(plan, 0) + 1

    return {
        "tenants": {
            "total": len(tenant_rows),
            "active": sum(1 for t in tenant_rows if t.get("active", True)),
            "disabled": sum(1 for t in tenant_rows if not t.get("active", True)),
            "by_plan": plan_breakdown,
        },
        "agents": {
            "total": len(agent_rows),
            "active": sum(1 for a in agent_rows if a.get("active", True)),
        },
        "calls": {
            "total": len(call_rows),
            "active_now": len(active_calls),
            "today": len(calls_today),
            "total_minutes": round(total_duration / 60, 1),
        },
    }


# ─── Tenants ──────────────────────────────────────────────────────────────────

@router.get("/tenants", dependencies=[Depends(_verify_token)])
def list_tenants(
    plan: Optional[str] = None,
    active: Optional[bool] = None,
    search: Optional[str] = None,
):
    db = get_db()
    q = db.table("tenants").select("*")
    if plan:
        q = q.eq("plan", plan)
    if active is not None:
        q = q.eq("active", active)
    rows = q.order("created_at", desc=True).execute().data or []

    if search:
        s = search.lower()
        rows = [r for r in rows if s in (r.get("name") or "").lower() or s in (r.get("email") or "").lower()]

    # Enrich with agent + call counts
    tenant_ids = [r["id"] for r in rows]
    agent_counts: dict = {}
    call_counts: dict = {}

    if tenant_ids:
        agents = db.table("agents").select("tenant_id").in_("tenant_id", tenant_ids).execute().data or []
        for a in agents:
            tid = a["tenant_id"]
            agent_counts[tid] = agent_counts.get(tid, 0) + 1

        calls = db.table("calls").select("tenant_id").in_("tenant_id", tenant_ids).execute().data or []
        for c in calls:
            tid = c["tenant_id"]
            call_counts[tid] = call_counts.get(tid, 0) + 1

    for r in rows:
        tid = r["id"]
        r["agent_count"] = agent_counts.get(tid, 0)
        r["call_count"] = call_counts.get(tid, 0)

    return rows


@router.get("/tenants/{tenant_id}", dependencies=[Depends(_verify_token)])
def get_tenant(tenant_id: str):
    db = get_db()
    tenant = db.table("tenants").select("*").eq("id", tenant_id).maybe_single().execute()
    if not tenant.data:
        raise HTTPException(status_code=404, detail="Tenant not found")

    agents = db.table("agents").select("*").eq("tenant_id", tenant_id).order("created_at", desc=True).execute().data or []
    calls = db.table("calls").select("id, status, direction, duration_sec, phone, created_at").eq("tenant_id", tenant_id).order("created_at", desc=True).limit(20).execute().data or []
    numbers = db.table("phone_numbers").select("*").eq("tenant_id", tenant_id).execute().data or []

    return {
        **tenant.data,
        "agents": agents,
        "recent_calls": calls,
        "phone_numbers": numbers,
    }


class UpdateTenantBody(BaseModel):
    plan: Optional[str] = None
    active: Optional[bool] = None
    name: Optional[str] = None


@router.patch("/tenants/{tenant_id}", dependencies=[Depends(_verify_token)])
def update_tenant(tenant_id: str, body: UpdateTenantBody):
    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = db.table("tenants").update(updates).eq("id", tenant_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return result.data[0]


@router.delete("/tenants/{tenant_id}", dependencies=[Depends(_verify_token)])
async def delete_tenant(tenant_id: str):
    db = get_db()
    # Delete Supabase auth user via admin API
    auth_url = f"{settings.supabase_url}/auth/v1/admin/users/{tenant_id}"
    async with httpx.AsyncClient() as client:
        await client.delete(
            auth_url,
            headers={"apikey": settings.supabase_service_key, "Authorization": f"Bearer {settings.supabase_service_key}"},
        )
    # Cascade deletes agents, calls, etc. via FK ON DELETE CASCADE
    db.table("tenants").delete().eq("id", tenant_id).execute()
    return {"deleted": True}


# ─── Agents (cross-tenant) ────────────────────────────────────────────────────

@router.get("/agents", dependencies=[Depends(_verify_token)])
def list_all_agents(tenant_id: Optional[str] = None, search: Optional[str] = None):
    db = get_db()
    q = db.table("agents").select("*, tenants(name, email)")
    if tenant_id:
        q = q.eq("tenant_id", tenant_id)
    rows = q.order("created_at", desc=True).execute().data or []

    if search:
        s = search.lower()
        rows = [r for r in rows if s in (r.get("name") or "").lower()]

    return rows


@router.patch("/agents/{agent_id}", dependencies=[Depends(_verify_token)])
def admin_update_agent(agent_id: str, body: dict):
    db = get_db()
    allowed = {"name", "prompt", "greeting", "active", "llm_provider", "stt_provider", "tts_provider", "voice", "language"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields")
    result = db.table("agents").update(updates).eq("id", agent_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Agent not found")
    return result.data[0]


@router.delete("/agents/{agent_id}", dependencies=[Depends(_verify_token)])
def admin_delete_agent(agent_id: str):
    db = get_db()
    db.table("agents").delete().eq("id", agent_id).execute()
    return {"deleted": True}


# ─── Calls (cross-tenant) ─────────────────────────────────────────────────────

@router.get("/calls", dependencies=[Depends(_verify_token)])
def list_all_calls(
    tenant_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
):
    db = get_db()
    q = db.table("calls").select("*, tenants(name), agents(name)")
    if tenant_id:
        q = q.eq("tenant_id", tenant_id)
    if status:
        q = q.eq("status", status)
    rows = q.order("created_at", desc=True).limit(min(limit, 200)).execute().data or []
    return rows


# ─── Platform Config ──────────────────────────────────────────────────────────

@router.get("/config", dependencies=[Depends(_verify_token)])
def get_config():
    db = get_db()
    rows = db.table("platform_config").select("key, value, updated_at").execute().data or []
    return {r["key"]: r["value"] for r in rows}


@router.patch("/config", dependencies=[Depends(_verify_token)])
def update_config(body: dict):
    db = get_db()
    for key, value in body.items():
        db.table("platform_config").upsert(
            {"key": key, "value": str(value), "updated_at": "now()"}
        ).execute()
    return {"updated": list(body.keys())}


# ─── System Health ────────────────────────────────────────────────────────────

@router.get("/health", dependencies=[Depends(_verify_token)])
async def system_health():
    services = [
        {"name": "vani-api",         "url": "https://api.vani.live/health"},
        {"name": "vani-orchestrator","url": "https://orchestrator.vani.live/health"},
        {"name": "vani-engine",      "url": "https://engine.vani.live/health"},
    ]
    results = []
    async with httpx.AsyncClient(timeout=5.0) as client:
        for svc in services:
            try:
                r = await client.get(svc["url"])
                results.append({
                    "name": svc["name"],
                    "url": svc["url"],
                    "status": "healthy" if r.status_code == 200 else "degraded",
                    "latency_ms": round(r.elapsed.total_seconds() * 1000),
                    "response": r.json() if r.status_code == 200 else None,
                })
            except Exception as e:
                results.append({
                    "name": svc["name"],
                    "url": svc["url"],
                    "status": "down",
                    "latency_ms": None,
                    "error": str(e),
                })
    return {"services": results, "checked_at": int(time.time())}


# ─── Tenant Impersonation ─────────────────────────────────────────────────────

@router.post("/tenants/{tenant_id}/impersonate", dependencies=[Depends(_verify_token)])
async def impersonate_tenant(tenant_id: str):
    """Generate a magic link for this tenant so admin can log in as them."""
    db = get_db()
    tenant = db.table("tenants").select("email").eq("id", tenant_id).maybe_single().execute()
    if not tenant.data:
        raise HTTPException(status_code=404, detail="Tenant not found")

    email = tenant.data["email"]
    auth_url = f"{settings.supabase_url}/auth/v1/admin/users/{tenant_id}/magic_link"
    async with httpx.AsyncClient() as client:
        r = await client.post(
            auth_url,
            headers={
                "apikey": settings.supabase_service_key,
                "Authorization": f"Bearer {settings.supabase_service_key}",
                "Content-Type": "application/json",
            },
            json={"email": email},
        )

    if r.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail="Failed to generate magic link")

    data = r.json()
    magic_url = data.get("action_link") or data.get("magic_link") or ""
    return {"email": email, "magic_link": magic_url}


# ─── Plans Management ─────────────────────────────────────────────────────────

PLAN_DEFINITIONS = {
    "starter": {
        "name": "Starter",
        "max_agents": 2,
        "max_calls_per_month": 500,
        "max_concurrent_calls": 2,
        "features": ["basic_analytics", "kb_upload", "webhooks"],
    },
    "growth": {
        "name": "Growth",
        "max_agents": 10,
        "max_calls_per_month": 5000,
        "max_concurrent_calls": 10,
        "features": ["basic_analytics", "advanced_analytics", "kb_upload", "webhooks", "campaigns", "api_access"],
    },
    "enterprise": {
        "name": "Enterprise",
        "max_agents": -1,
        "max_calls_per_month": -1,
        "max_concurrent_calls": -1,
        "features": ["all"],
    },
}


@router.get("/plans", dependencies=[Depends(_verify_token)])
def get_plans():
    db = get_db()
    plan_counts: dict = {}
    tenants = db.table("tenants").select("plan").execute().data or []
    for t in tenants:
        p = t.get("plan", "starter")
        plan_counts[p] = plan_counts.get(p, 0) + 1
    return [
        {**v, "slug": k, "tenant_count": plan_counts.get(k, 0)}
        for k, v in PLAN_DEFINITIONS.items()
    ]


# ── Number Hunter (admin view) ────────────────────────────────────────────────

@router.get("/hunter/results", dependencies=[Depends(_verify_token)])
def admin_hunter_results(
    status: Optional[str] = None,
    country: Optional[str] = None,
    tier: Optional[str] = None,
):
    db = get_db()
    q = db.table("number_hunt_results").select("*")
    if status:
        q = q.eq("status", status)
    if country:
        q = q.eq("country", country)
    if tier:
        q = q.eq("tier", tier)
    q = q.order("ai_score", desc=True).order("first_seen", desc=True).limit(2000)
    return q.execute().data or []


@router.get("/hunter/scans", dependencies=[Depends(_verify_token)])
def admin_hunter_scans(country: Optional[str] = None):
    db = get_db()
    q = db.table("number_scan_runs").select("*").order("started_at", desc=True).limit(20)
    if country:
        q = q.eq("country", country)
    return q.execute().data or []


@router.get("/hunter/status", dependencies=[Depends(_verify_token)])
def admin_hunter_status():
    from app.routers.number_hunter import _scan_running, _scan_progress, NANP_COUNTRIES
    running = {c: _scan_progress.get(c, {}) for c in _scan_running if _scan_running[c]}

    # Clean up orphaned DB scans: if no in-memory state but DB says "running",
    # the container restarted mid-scan — mark them as failed immediately
    if not running:
        try:
            db = get_db()
            from datetime import datetime, timezone
            orphaned = (
                db.table("number_scan_runs")
                .select("id")
                .eq("status", "running")
                .execute()
                .data or []
            )
            for row in orphaned:
                db.table("number_scan_runs").update({
                    "status": "failed",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "error": "Scan interrupted by server restart",
                }).eq("id", row["id"]).execute()
        except Exception:
            pass

    return {"running": running, "countries": list(NANP_COUNTRIES.keys())}


class AdminScanRequest(BaseModel):
    country: Optional[str] = None           # single country (legacy)
    countries: Optional[list] = None        # multiple countries (new)


@router.post("/hunter/scan", dependencies=[Depends(_verify_token)])
async def admin_hunter_scan(body: AdminScanRequest):
    import asyncio
    from app.routers.number_hunter import _scan_running, daily_scan, NANP_COUNTRIES, build_patterns

    # Resolve country list — support both single `country` and list `countries`
    raw = body.countries or ([body.country] if body.country else None)
    if not raw:
        raise HTTPException(status_code=400, detail="Provide 'country' or 'countries'")
    targets = [c.upper() for c in raw]
    unknown = [c for c in targets if c not in NANP_COUNTRIES]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown country codes: {unknown}")
    already = [c for c in targets if _scan_running.get(c) is True]
    if already:
        raise HTTPException(status_code=409, detail=f"Already scanning: {already}")

    total_patterns = sum(len(build_patterns(NANP_COUNTRIES[c])) for c in targets)
    # Pre-mark as queued BEFORE create_task so status endpoint shows them immediately
    for c in targets:
        _scan_running[c] = "queued"
    asyncio.create_task(daily_scan(countries=targets))
    return {
        "started": True,
        "countries": targets,
        "patterns": total_patterns,
        "parallel": len(targets) > 1,
    }


@router.post("/hunter/scan-all", dependencies=[Depends(_verify_token)])
async def admin_hunter_scan_all():
    import asyncio
    from app.routers.number_hunter import daily_scan, _scan_running
    if any(_scan_running.values()):
        raise HTTPException(status_code=409, detail="A scan is already running")
    asyncio.create_task(daily_scan())
    return {"started": True, "message": "All 15 countries queued in parallel (up to 4 at once)"}


# ── Scan Schedules ────────────────────────────────────────────────────────────

class ScheduleBody(BaseModel):
    name: str = "My Schedule"
    is_active: bool = True
    frequency: str          # hourly | daily | weekly | monthly
    hour_of_day: Optional[int] = 2
    day_of_week: Optional[int] = None   # 0=Mon…6=Sun (weekly only)
    day_of_month: Optional[int] = None  # 1-31 (monthly only)
    countries: Optional[list] = None    # None = all
    service: str = "twilio"
    tiers: Optional[list] = None        # None = all


def _compute_next_run(frequency: str, hour_of_day, day_of_week, day_of_month) -> str:
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    h = int(hour_of_day or 2)

    if frequency == "hourly":
        nxt = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    elif frequency == "daily":
        nxt = now.replace(hour=h, minute=0, second=0, microsecond=0)
        if nxt <= now:
            nxt += timedelta(days=1)
    elif frequency == "weekly":
        dow = int(day_of_week or 0)
        days_ahead = (dow - now.weekday()) % 7
        if days_ahead == 0 and now.hour >= h:
            days_ahead = 7
        nxt = (now + timedelta(days=days_ahead)).replace(hour=h, minute=0, second=0, microsecond=0)
    elif frequency == "monthly":
        dom = int(day_of_month or 1)
        try:
            nxt = now.replace(day=dom, hour=h, minute=0, second=0, microsecond=0)
        except ValueError:
            nxt = now.replace(day=28, hour=h, minute=0, second=0, microsecond=0)
        if nxt <= now:
            month = now.month + 1 if now.month < 12 else 1
            year = now.year if now.month < 12 else now.year + 1
            try:
                nxt = nxt.replace(year=year, month=month)
            except ValueError:
                nxt = nxt.replace(year=year, month=month, day=28)
    else:
        nxt = now + timedelta(hours=1)

    return nxt.isoformat()


@router.get("/hunter/schedules", dependencies=[Depends(_verify_token)])
def list_schedules():
    db = get_db()
    return db.table("number_scan_schedules").select("*").order("created_at", desc=True).execute().data or []


@router.post("/hunter/schedules", dependencies=[Depends(_verify_token)], status_code=201)
def create_schedule(body: ScheduleBody):
    db = get_db()
    if body.frequency not in ("hourly", "daily", "weekly", "monthly"):
        raise HTTPException(status_code=400, detail="Invalid frequency")
    next_run = _compute_next_run(body.frequency, body.hour_of_day, body.day_of_week, body.day_of_month)
    result = db.table("number_scan_schedules").insert({
        "name": body.name,
        "is_active": body.is_active,
        "frequency": body.frequency,
        "hour_of_day": body.hour_of_day,
        "day_of_week": body.day_of_week,
        "day_of_month": body.day_of_month,
        "countries": body.countries,
        "service": body.service,
        "tiers": body.tiers,
        "next_run_at": next_run,
    }).execute()
    return result.data[0]


@router.put("/hunter/schedules/{schedule_id}", dependencies=[Depends(_verify_token)])
def update_schedule(schedule_id: str, body: ScheduleBody):
    db = get_db()
    if body.frequency not in ("hourly", "daily", "weekly", "monthly"):
        raise HTTPException(status_code=400, detail="Invalid frequency")
    next_run = _compute_next_run(body.frequency, body.hour_of_day, body.day_of_week, body.day_of_month)
    result = db.table("number_scan_schedules").update({
        "name": body.name,
        "is_active": body.is_active,
        "frequency": body.frequency,
        "hour_of_day": body.hour_of_day,
        "day_of_week": body.day_of_week,
        "day_of_month": body.day_of_month,
        "countries": body.countries,
        "service": body.service,
        "tiers": body.tiers,
        "next_run_at": next_run,
        "updated_at": "now()",
    }).eq("id", schedule_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return result.data[0]


@router.delete("/hunter/schedules/{schedule_id}", dependencies=[Depends(_verify_token)])
def delete_schedule(schedule_id: str):
    db = get_db()
    db.table("number_scan_schedules").delete().eq("id", schedule_id).execute()
    return {"deleted": True}


@router.delete("/hunter/scans", dependencies=[Depends(_verify_token)])
def admin_clear_scans():
    """Delete all scan log entries."""
    db = get_db()
    db.table("number_scan_runs").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    return {"cleared": True}


@router.delete("/hunter/results", dependencies=[Depends(_verify_token)])
def admin_clear_results():
    """Delete all hunt results (available + gone). Purchased are kept."""
    db = get_db()
    db.table("number_hunt_results").delete().in_("status", ["available", "gone"]).execute()
    return {"cleared": True}


class AdminPurchaseRequest(BaseModel):
    number: str


@router.post("/hunter/purchase", dependencies=[Depends(_verify_token)])
async def admin_hunter_purchase(body: AdminPurchaseRequest):
    import asyncio
    from app.routers.number_hunter import NANP_COUNTRIES
    from app.config import settings as _s
    if not _s.twilio_account_sid or not _s.twilio_auth_token:
        raise HTTPException(status_code=503, detail="Twilio credentials not configured")
    db = get_db()
    try:
        from twilio.rest import Client
        client = Client(_s.twilio_account_sid, _s.twilio_auth_token)
        purchased = await asyncio.to_thread(
            lambda: client.incoming_phone_numbers.create(phone_number=body.number)
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Twilio purchase failed: {exc}")
    # Detect country from existing record
    row = db.table("number_hunt_results").select("country").eq("number", body.number).maybe_single().execute()
    country = row.data["country"] if row.data else "US"
    db.table("number_hunt_results").update({
        "status": "purchased",
        "purchased_at": "now()",
    }).eq("number", body.number).eq("country", country).execute()
    return {"number": body.number, "sid": purchased.sid}
