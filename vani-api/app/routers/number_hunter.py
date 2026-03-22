"""Number Hunter — finds memorable Twilio phone numbers across NANP countries.

Patterns searched:
  S-ten         : AAAAAAAAAA (10 identical digits)
  A-double-seq  : xyzxyz + 4-digit sequential/pattern ending
  A-double-rev  : xyzxyz + rev(xyz) + single digit
  A-seven       : xyz + aaaaaaa (area code + 7 identical, e.g. 919-111-1111)
  A-mirror      : xyz + rev(xyz) + **** (open mirror)
  B-segments    : AAA-BBB-CCCC (three uniform segments)
  B-fivefive    : AAAAABBBBB (5+5 split)
  TF-double-*   : Toll-free NPA repeated twice + pattern ending (US only)

Countries: all NANP (+1) nations — US, CA, PR, VI, GU, AS, MP, BM, KY, JM, TT, BB, BS, GD, DO
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.db import get_db
from app.middleware.auth import get_tenant_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/hunter", tags=["hunter"])

# ── Per-country area code lists ───────────────────────────────────────────────

CA_CODES = [
    204, 226, 236, 249, 250, 263, 289,
    306, 343, 354, 365, 367, 368, 382, 387,
    403, 416, 418, 428, 431, 437, 438, 450, 468, 474,
    506, 514, 519, 548, 579, 581, 587,
    604, 613, 639, 647, 672, 683,
    705, 709, 742, 753, 778, 780, 782,
    807, 819, 825, 867, 873, 879,
    902, 905,
]

NANP_COUNTRIES: dict[str, list[int]] = {
    "US": list(range(200, 1000)),   # all valid NPAs 200–999
    "CA": CA_CODES,
    "PR": [787, 939],               # Puerto Rico
    "VI": [340],                    # US Virgin Islands
    "GU": [671],                    # Guam
    "AS": [684],                    # American Samoa
    "MP": [670],                    # N. Mariana Islands
    "BM": [441],                    # Bermuda
    "KY": [345],                    # Cayman Islands
    "JM": [876],                    # Jamaica
    "TT": [868],                    # Trinidad & Tobago
    "BB": [246],                    # Barbados
    "BS": [242],                    # Bahamas
    "GD": [473],                    # Grenada
    "DO": [809, 829, 849],          # Dominican Republic
}

SEQ4 = [
    "0123", "1234", "2345", "3456", "4567", "5678", "6789",   # ascending
    "9876", "8765", "7654", "6543", "5432", "4321", "3210",   # descending
    "0000", "1111", "2222", "3333", "4444", "5555",
    "6666", "7777", "8888", "9999",                            # quads
    "1357", "2468", "9753", "8642",                            # odd/even
    "1212", "2323", "3434", "4545", "5656",
    "6767", "7878", "8989",                                    # abab
    "2211", "3322", "4433", "5544", "6655",
    "7766", "8877", "9988",                                    # aabb desc
    "1122", "2233", "3344", "4455", "5566",
    "6677", "7788", "8899",                                    # aabb asc
]

TF_PREFIXES = ["800", "888", "877", "866", "855", "844", "833", "822"]

# ── Active scan state (in-process tracking) ───────────────────────────────────
_scan_running: dict[str, bool] = {}
_scan_progress: dict[str, dict] = {}  # country -> {searched, total, found}


# ── Pattern generators ────────────────────────────────────────────────────────

def build_patterns(npas: list[int]) -> list[dict]:
    """Return all search dicts for the given NPA list."""
    s: list[dict] = []

    # 1. xyzxyz + SEQ4 endings
    for n in npas:
        npa = str(n)
        for end in SEQ4:
            s.append({"label": f"{npa}x2-{end}", "pattern": f"{npa}{npa}{end}", "tier": "A-double-seq"})

    # 2. 10 identical — AAAAAAAAAA
    for a in range(2, 10):
        s.append({"label": f"{a}x10", "pattern": str(a) * 10, "tier": "S-ten"})

    # 3. AAA-BBB-CCCC (uniform segments)
    for a in range(2, 10):
        for b in range(2, 10):
            for c in range(0, 10):
                if a == b == c:
                    continue
                s.append({
                    "label": f"{a}x3-{b}x3-{c}x4",
                    "pattern": str(a) * 3 + str(b) * 3 + str(c) * 4,
                    "tier": "B-segments",
                })

    # 4. AAAAABBBBB (5+5 split)
    for a in range(2, 10):
        for b in range(0, 10):
            if a == b:
                continue
            s.append({
                "label": f"{a}x5-{b}x5",
                "pattern": str(a) * 5 + str(b) * 5,
                "tier": "B-fivefive",
            })

    # 5. NPA + a×7 = xyz-aaa-aaaa (e.g. 919-111-1111)
    for n in npas:
        npa = str(n)
        for a in range(2, 10):  # NXX must start ≥ 2
            s.append({
                "label": f"{npa}-{a}x7",
                "pattern": npa + str(a) * 7,
                "tier": "A-seven",
            })

    # 6. NPA·rev(NPA)·**** (mirror open)
    for n in npas:
        npa = str(n)
        rev = npa[::-1]
        if int(rev[0]) < 2:
            continue
        s.append({
            "label": f"{npa}-{rev}-xxxx",
            "pattern": f"{npa}{rev}****",
            "tier": "A-mirror",
        })

    # 7. NPA×2·rev(NPA)·X
    for n in npas:
        npa = str(n)
        rev = npa[::-1]
        for x in range(0, 10):
            s.append({
                "label": f"{npa}x2-{rev}-{x}",
                "pattern": f"{npa}{npa}{rev}{x}",
                "tier": "A-double-rev",
            })

    return s


def build_tollfree_patterns() -> list[dict]:
    s: list[dict] = []
    for tf in TF_PREFIXES:
        for a in range(0, 10):
            s.append({"label": f"{tf}x2-{a}x4", "pattern": f"{tf}{tf}" + str(a) * 4, "tier": "TF-double-aaaa"})
        for a in range(0, 10):
            for b in range(0, 10):
                if a == b:
                    continue
                s.append({"label": f"{tf}x2-{a}{a}{b}{b}", "pattern": f"{tf}{tf}{a}{a}{b}{b}", "tier": "TF-double-aabb"})
        for end in ["1234", "2345", "3456", "4567", "5678", "6789",
                    "9876", "8765", "7654", "6543", "5432", "4321"]:
            s.append({"label": f"{tf}x2-{end}", "pattern": f"{tf}{tf}{end}", "tier": "TF-double-seq"})
    return s


# ── Twilio search (sync — called via asyncio.to_thread) ───────────────────────

def _twilio_search(country: str, pattern: str) -> list[str]:
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        return []
    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        results = client.available_phone_numbers(country).local.list(
            contains=pattern, limit=10
        )
        return [n.phone_number for n in results]
    except Exception:
        return []


# ── Core scan logic ───────────────────────────────────────────────────────────

async def scan_country(country: str, npas: list[int]) -> dict:
    """Scan one country; upserts results into DB. Returns summary dict."""
    db = get_db()
    scan_id: Optional[str] = None

    try:
        patterns = build_patterns(npas)
        if country == "US":
            patterns += build_tollfree_patterns()

        # Record scan run
        run = db.table("number_scan_runs").insert({
            "country": country,
            "total_patterns": len(patterns),
            "status": "running",
        }).execute().data[0]
        scan_id = run["id"]

        _scan_progress[country] = {"searched": 0, "total": len(patterns), "found": 0}

        found = 0
        new_count = 0
        seen: set[str] = set()

        CONCURRENCY = 15
        sem = asyncio.Semaphore(CONCURRENCY)

        async def do_one(p: dict) -> None:
            nonlocal found, new_count
            async with sem:
                nums = await asyncio.to_thread(_twilio_search, country, p["pattern"])
                for num in nums:
                    if num in seen:
                        continue
                    seen.add(num)
                    found += 1

                    existing = (
                        db.table("number_hunt_results")
                        .select("id,status")
                        .eq("number", num)
                        .eq("country", country)
                        .maybe_single()
                        .execute()
                        .data
                    )
                    now = datetime.now(timezone.utc).isoformat()
                    if existing:
                        update: dict = {"last_seen": now}
                        if existing["status"] == "gone":
                            update["status"] = "available"
                            new_count += 1
                        db.table("number_hunt_results").update(update).eq("id", existing["id"]).execute()
                    else:
                        db.table("number_hunt_results").insert({
                            "number": num,
                            "country": country,
                            "tier": p["tier"],
                            "label": p["label"],
                            "pattern": p["pattern"],
                            "status": "available",
                        }).execute()
                        new_count += 1

                _scan_progress[country]["searched"] += 1
                _scan_progress[country]["found"] = found

        # Run all patterns concurrently (semaphore throttles to 15 at a time)
        await asyncio.gather(*[do_one(p) for p in patterns])

        # Mark numbers not seen this run as gone
        gone_count = 0
        all_avail = (
            db.table("number_hunt_results")
            .select("number,id")
            .eq("country", country)
            .eq("status", "available")
            .execute()
            .data
        )
        for row in all_avail:
            if row["number"] not in seen:
                db.table("number_hunt_results").update({"status": "gone"}).eq("id", row["id"]).execute()
                gone_count += 1

        now = datetime.now(timezone.utc).isoformat()
        db.table("number_scan_runs").update({
            "status": "completed",
            "completed_at": now,
            "found_count": found,
            "new_count": new_count,
            "gone_count": gone_count,
        }).eq("id", scan_id).execute()

        _scan_progress.pop(country, None)
        return {"country": country, "found": found, "new": new_count, "gone": gone_count}

    except Exception as exc:
        logger.error("Scan failed for %s: %s", country, exc)
        if scan_id:
            db.table("number_scan_runs").update({
                "status": "failed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "error": str(exc),
            }).eq("id", scan_id).execute()
        _scan_progress.pop(country, None)
        raise


async def daily_scan() -> None:
    """Run all NANP countries sequentially — called by the startup scheduler."""
    for country, npas in NANP_COUNTRIES.items():
        if _scan_running.get(country):
            continue
        _scan_running[country] = True
        try:
            logger.info("Daily scan starting: %s", country)
            await scan_country(country, npas)
            logger.info("Daily scan done: %s", country)
        except Exception as exc:
            logger.error("Daily scan error for %s: %s", country, exc)
        finally:
            _scan_running[country] = False
        await asyncio.sleep(2)  # brief gap between countries


# ── API Endpoints ─────────────────────────────────────────────────────────────

@router.get("/results")
async def list_results(
    country: Optional[str] = None,
    tier: Optional[str] = None,
    status: str = "available",
    _: str = Depends(get_tenant_id),
):
    """List memorable numbers found by the hunter."""
    db = get_db()
    q = (
        db.table("number_hunt_results")
        .select("*")
        .eq("status", status)
        .order("first_seen", desc=True)
    )
    if country:
        q = q.eq("country", country.upper())
    if tier:
        q = q.eq("tier", tier)
    return q.limit(1000).execute().data


@router.get("/scans")
async def list_scans(
    country: Optional[str] = None,
    _: str = Depends(get_tenant_id),
):
    """Recent scan run history."""
    db = get_db()
    q = db.table("number_scan_runs").select("*").order("started_at", desc=True)
    if country:
        q = q.eq("country", country.upper())
    return q.limit(100).execute().data


@router.get("/status")
async def scan_status(_: str = Depends(get_tenant_id)):
    """Return which countries are currently scanning + progress."""
    return {
        "running": {c: _scan_progress.get(c, {}) for c, v in _scan_running.items() if v},
        "countries": list(NANP_COUNTRIES.keys()),
    }


class ScanRequest(BaseModel):
    country: str = "US"


@router.post("/scan")
async def trigger_scan(
    body: ScanRequest,
    background_tasks: BackgroundTasks,
    _: str = Depends(get_tenant_id),
):
    """Trigger a manual scan for a specific country."""
    country = body.country.upper()
    if country not in NANP_COUNTRIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown country '{country}'. Valid: {list(NANP_COUNTRIES.keys())}",
        )
    if _scan_running.get(country):
        raise HTTPException(status_code=409, detail=f"Scan already running for {country}")

    async def run() -> None:
        _scan_running[country] = True
        try:
            await scan_country(country, NANP_COUNTRIES[country])
        finally:
            _scan_running[country] = False

    background_tasks.add_task(run)
    return {"started": True, "country": country, "patterns": len(build_patterns(NANP_COUNTRIES[country]))}


class PurchaseRequest(BaseModel):
    number: str


@router.post("/purchase")
async def purchase_number(
    body: PurchaseRequest,
    tenant_id: str = Depends(get_tenant_id),
):
    """Purchase a memorable number via Twilio and record it."""
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        raise HTTPException(status_code=503, detail="Twilio credentials not configured")

    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        purchased = await asyncio.to_thread(
            lambda: client.incoming_phone_numbers.create(phone_number=body.number)
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Twilio purchase failed: {exc}")

    db = get_db()
    db.table("number_hunt_results").update({
        "status": "purchased",
        "purchased_at": datetime.now(timezone.utc).isoformat(),
    }).eq("number", body.number).execute()

    return {"purchased": True, "number": purchased.phone_number, "sid": purchased.sid}
