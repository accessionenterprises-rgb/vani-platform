"""Number Hunter — finds memorable Twilio phone numbers across NANP countries.

Patterns searched:
  P-suffix-quad  : ****AAAA — suffix quad repeats (0000…9999 anywhere)
  P-seq5/6/7     : long sequential runs (12345, 123456, 1234567)
  A-double-seq   : xyzxyz + 52 sequential/pattern endings (SEQ4)
  A-seven        : xyz + aaaaaaa (e.g. 919-111-1111)
  A-mirror       : xyz + rev(xyz) open (6-char prefix)
  A-double-rev   : xyzxyz + rev(xyz) + single digit
  B-segments     : AAA-BBB-CCCC (three uniform segments)
  B-fivefive     : AAAAABBBBB (5+5 split)
  B-double-block : AAABBB (double 3-block)
  B-alternating  : ABABAB (alternating 6-block)
  B-alt10        : ABABABABAB (full 10-digit alternating)
  B-aab/aba/abb  : 3-unit repeating triples ×3 + free last digit
  B-abc-triple   : ABC×3 — 3-distinct-digit repeating triple
  TF-double-*    : Toll-free NPA×2 + AAAA/AABB/sequential (US only)

  AI scoring: after each country scan, new numbers are batch-scored by
  Claude Haiku for memorability (1-10) and stored as ai_score + ai_reason.

Countries: all NANP (+1) nations — US, CA, PR, VI, GU, AS, MP, BM, KY, JM, TT, BB, BS, GD, DO
"""

import asyncio
import json
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

# Assigned US-only area codes (~320 vs range(200,1000)=800 which wastes ~60% on unassigned/CA NPAs)
US_CODES = [
    201, 202, 203, 205, 206, 207, 208, 209, 210,
    212, 213, 214, 215, 216, 217, 218, 219, 220, 223,
    224, 225, 228, 229, 231, 234, 239, 240,
    248, 251, 252, 253, 254, 256,
    260, 262, 267, 269, 270, 272, 276, 279, 281,
    301, 302, 303, 304, 305, 307, 308, 309,
    310, 312, 313, 314, 315, 316, 317, 318, 319, 320,
    321, 323, 325, 326, 330, 331, 332, 334, 336, 337,
    339, 341, 346, 347, 351, 352, 360,
    361, 364, 380, 385, 386,
    401, 402, 404, 405, 406, 407, 408, 409, 410,
    412, 413, 414, 415, 417, 419, 423, 424, 425,
    430, 432, 434, 435, 442, 443, 445, 448, 458, 463, 464,
    469, 470, 475, 478, 479, 480, 484,
    501, 502, 503, 504, 505, 507, 508, 509, 510, 512,
    513, 515, 516, 517, 518, 520, 530, 531,
    534, 539, 540, 541, 551, 557, 559, 561, 562,
    563, 564, 567, 570, 571, 573, 574, 575, 580,
    582, 585, 586,
    601, 602, 603, 605,
    606, 607, 608, 609, 610, 612, 614, 615, 616,
    617, 618, 619, 620, 623, 626, 628, 629, 630, 631,
    636, 641, 646, 650, 651, 657, 659, 660,
    661, 662, 664, 667, 669, 678, 679,
    680, 681, 682, 689,
    701, 702, 703, 704,
    706, 707, 708, 712, 713, 714, 715, 716,
    717, 718, 719, 720, 724, 725, 726, 727, 730, 731,
    732, 734, 737, 740, 743, 747, 754, 757,
    760, 762, 763, 764, 765, 769, 770, 772, 773, 774,
    775, 779, 781, 785, 786, 787,
    801, 802, 803, 804, 805, 806, 808, 810, 812, 813,
    814, 815, 816, 817, 818, 820, 828, 830,
    831, 832, 838, 843, 845, 847, 848, 850, 854, 856,
    857, 858, 859, 860, 861, 862, 863, 864, 865,
    870, 872, 878,
    901, 903, 904,
    906, 907, 908, 909, 910, 912, 913, 914, 915, 916,
    917, 918, 919, 920, 925, 928, 929, 930, 931, 934,
    936, 937, 938, 939, 940, 941, 943, 945, 947, 948,
    949, 951, 952, 954, 956, 959, 970, 971, 972, 973,
    975, 978, 979, 980, 983, 984, 985, 986, 989,
]

NANP_COUNTRIES: dict[str, list[int]] = {
    "US": US_CODES,
    "CA": CA_CODES,
    "PR": [787, 939],
    "VI": [340],
    "GU": [671],
    "AS": [684],
    "MP": [670],
    "BM": [441],
    "KY": [345],
    "JM": [876],
    "TT": [868],
    "BB": [246],
    "BS": [242],
    "GD": [473],
    "DO": [809, 829, 849],
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

# ── Active scan state ─────────────────────────────────────────────────────────
_scan_running: dict[str, bool] = {}
_scan_progress: dict[str, dict] = {}


# ── Pattern generators ────────────────────────────────────────────────────────

def build_patterns(npas: list[int], tiers_filter: Optional[list[str]] = None) -> list[dict]:
    """Return all search dicts for the given NPA list, optionally limited to tiers_filter."""
    s: list[dict] = []

    # 0. Long sequential runs (5, 6, 7 digits)
    for length in (5, 6, 7):
        tier = f"P-seq{length}"
        max_start = 10 - length
        for i in range(max_start + 1):
            asc  = "".join(str(i + k) for k in range(length))
            desc = "".join(str(9 - i - k) for k in range(length))
            s.append({"label": f"seq{length}-asc-{i}",    "pattern": asc,  "tier": tier})
            s.append({"label": f"seq{length}-desc-{9-i}", "pattern": desc, "tier": tier})

    # 1. Pure suffix quads (0000…9999 anywhere in number)
    for a in range(0, 10):
        s.append({"label": f"ends-{a}x4", "pattern": str(a) * 4, "tier": "P-suffix-quad"})

    # 2. xyzxyz + SEQ4 endings
    for n in npas:
        npa = str(n)
        for end in SEQ4:
            s.append({"label": f"{npa}x2-{end}", "pattern": f"{npa}{npa}{end}", "tier": "A-double-seq"})

    # 3. NPA + a×7 (e.g. 919-222-2222) — full a∈{2..9}
    for n in npas:
        npa = str(n)
        for a in range(2, 10):
            s.append({"label": f"{npa}-{a}x7", "pattern": npa + str(a) * 7, "tier": "A-seven"})

    # 4. NPA·rev(NPA) open — 6-char substring, no wildcards
    for n in npas:
        npa = str(n)
        rev = npa[::-1]
        if int(rev[0]) < 2:
            continue
        s.append({"label": f"{npa}-{rev}-open", "pattern": f"{npa}{rev}", "tier": "A-mirror"})

    # 5. NPA×2·rev(NPA)·X — full x∈{0..9}
    for n in npas:
        npa = str(n)
        rev = npa[::-1]
        for x in range(0, 10):
            s.append({"label": f"{npa}x2-{rev}-{x}", "pattern": f"{npa}{npa}{rev}{x}", "tier": "A-double-rev"})

    # 6. AAA-BBB-CCCC (three uniform segments)
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

    # 7. AAAAABBBBB (5+5 split)
    for a in range(2, 10):
        for b in range(0, 10):
            if a == b:
                continue
            s.append({"label": f"{a}x5-{b}x5", "pattern": str(a) * 5 + str(b) * 5, "tier": "B-fivefive"})

    # 8. AAABBB (double 3-block)
    for a in range(2, 10):
        for b in range(0, 10):
            if a == b:
                continue
            s.append({"label": f"{a}x3-{b}x3-block", "pattern": str(a) * 3 + str(b) * 3, "tier": "B-double-block"})

    # 9. ABABAB (alternating 6-block)
    for a in range(2, 10):
        for b in range(0, 10):
            if a == b:
                continue
            s.append({"label": f"{a}{b}-alt6", "pattern": f"{a}{b}{a}{b}{a}{b}", "tier": "B-alternating"})

    # 10. ABABABABAB (full 10-digit alternating, b≥2 for NXX)
    for a in range(2, 10):
        for b in range(2, 10):
            if a == b:
                continue
            s.append({"label": f"{a}{b}-alt10", "pattern": f"{a}{b}" * 5, "tier": "B-alt10"})

    # 11. 3-unit repeating triples ×3 + free last digit (9-char prefix)
    for a in range(2, 10):
        for b in range(0, 10):
            if a == b:
                continue
            s.append({"label": f"{a}{a}{b}-triple", "pattern": f"{a}{a}{b}" * 3, "tier": "B-aab-triple"})
            s.append({"label": f"{a}{b}{a}-triple", "pattern": f"{a}{b}{a}" * 3, "tier": "B-aba-triple"})
            s.append({"label": f"{a}{b}{b}-triple", "pattern": f"{a}{b}{b}" * 3, "tier": "B-abb-triple"})

    # 12. ABC×3 + free (3 distinct digits, 9-char prefix)
    for a in range(2, 10):
        for b in range(0, 10):
            if b == a:
                continue
            for c in range(0, 10):
                if c == a or c == b:
                    continue
                s.append({"label": f"{a}{b}{c}-triple", "pattern": f"{a}{b}{c}" * 3, "tier": "B-abc-triple"})

    if tiers_filter:
        s = [p for p in s if p["tier"] in tiers_filter]
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


# ── AI memorability scoring ───────────────────────────────────────────────────

_SCORE_CHUNK = 150   # max numbers per Claude call


async def score_numbers_with_ai(numbers: list[str]) -> dict[str, dict]:
    """
    Batch-score phone numbers for memorability using Claude Haiku.
    Chunks into batches of 150 to stay within token limits.
    Returns dict: phone_number -> {score: int, reason: str}
    """
    if not numbers or not settings.anthropic_api_key:
        return {}

    def _fmt(n: str) -> str:
        d = n.replace("+1", "")
        return f"{d[:3]}-{d[3:6]}-{d[6:]}"

    def _parse_raw(raw: str) -> list:
        raw = raw.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        start = raw.find("[")
        end = raw.rfind("]")
        if start != -1 and end != -1:
            raw = raw[start:end + 1]
        return json.loads(raw)

    results: dict[str, dict] = {}

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

        for chunk_start in range(0, len(numbers), _SCORE_CHUNK):
            chunk = numbers[chunk_start:chunk_start + _SCORE_CHUNK]
            numbered = "\n".join(f"{i+1}. {_fmt(n)}" for i, n in enumerate(chunk))
            prompt = (
                "Rate each phone number 1-10 for vanity/memorability.\n"
                "Criteria: digit repetition, visual symmetry, spoken rhythm, instant recall.\n"
                "10 = instantly memorable (e.g. 800-888-8888). 1 = random.\n"
                'Reply ONLY as a JSON array: [{"i":1,"score":9,"reason":"..."},...]\n\n'
                f"Numbers:\n{numbered}"
            )
            try:
                msg = await asyncio.to_thread(
                    lambda p=prompt: client.messages.create(
                        model="claude-haiku-4-5-20251001",
                        max_tokens=2048,
                        messages=[{"role": "user", "content": p}],
                    )
                )
                scores = _parse_raw(msg.content[0].text)
                for entry in scores:
                    idx = entry["i"] - 1
                    if 0 <= idx < len(chunk):
                        results[chunk[idx]] = {
                            "score": int(entry["score"]),
                            "reason": entry.get("reason", ""),
                        }
            except Exception as exc:
                logger.warning("AI scoring chunk failed: %s", exc)

    except Exception as exc:
        logger.warning("AI scoring failed: %s", exc)

    return results


# ── Twilio search ─────────────────────────────────────────────────────────────

def _twilio_search(country: str, pattern: str) -> list[str]:
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        return []
    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        results = client.available_phone_numbers(country).local.list(contains=pattern, limit=10)
        return [n.phone_number for n in results]
    except Exception:
        return []


# ── Core scan logic ───────────────────────────────────────────────────────────

async def scan_country(country: str, npas: list[int], tiers_filter: Optional[list[str]] = None) -> dict:
    db = get_db()
    scan_id: Optional[str] = None

    try:
        patterns = build_patterns(npas, tiers_filter=tiers_filter)
        if country == "US":
            tf_patterns = build_tollfree_patterns()
            if tiers_filter:
                tf_patterns = [p for p in tf_patterns if p["tier"] in tiers_filter]
            patterns += tf_patterns

        run = db.table("number_scan_runs").insert({
            "country": country,
            "total_patterns": len(patterns),
            "status": "running",
        }).execute().data[0]
        scan_id = run["id"]

        _scan_progress[country] = {"searched": 0, "total": len(patterns), "found": 0, "service": "twilio"}

        found = 0
        new_count = 0
        seen: set[str] = set()
        newly_inserted: list[str] = []

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
                        newly_inserted.append(num)

                _scan_progress[country]["searched"] += 1
                _scan_progress[country]["found"] = found

        await asyncio.gather(*[do_one(p) for p in patterns])

        # Mark numbers not seen this run as gone (bulk update)
        all_avail = (
            db.table("number_hunt_results")
            .select("number,id")
            .eq("country", country)
            .eq("status", "available")
            .execute()
            .data
        )
        gone_ids = [row["id"] for row in all_avail if row["number"] not in seen]
        gone_count = len(gone_ids)
        if gone_ids:
            db.table("number_hunt_results").update({"status": "gone"}).in_("id", gone_ids).execute()

        # AI scoring for newly discovered numbers
        if newly_inserted:
            logger.info("AI scoring %d new numbers for %s", len(newly_inserted), country)
            scores = await score_numbers_with_ai(newly_inserted)
            for num, rating in scores.items():
                db.table("number_hunt_results").update({
                    "ai_score": rating["score"],
                    "ai_reason": rating["reason"],
                }).eq("number", num).eq("country", country).execute()

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


_COUNTRY_CONCURRENCY = 4   # max simultaneous country scans


async def daily_scan(countries: Optional[list[str]] = None, tiers_filter: Optional[list[str]] = None) -> None:
    """Scan all (or specified) NANP countries in parallel, up to _COUNTRY_CONCURRENCY at once."""
    targets = {c: npas for c, npas in NANP_COUNTRIES.items() if not countries or c in countries}
    sem = asyncio.Semaphore(_COUNTRY_CONCURRENCY)

    async def _run_one(country: str, npas: list[int]) -> None:
        if _scan_running.get(country) is True:  # skip if actively running; 'queued' is ok
            return
        async with sem:
            _scan_running[country] = True
            try:
                logger.info("Scan starting: %s", country)
                await scan_country(country, npas, tiers_filter=tiers_filter)
                logger.info("Scan done: %s", country)
                _scan_running[country] = False
            except Exception as exc:
                logger.error("Scan error for %s: %s", country, exc)
                # Keep _scan_running as "error" (truthy) so status endpoint returns it
                _scan_running[country] = "error"
                _scan_progress[country] = {"searched": 0, "total": 0, "found": 0, "error": str(exc), "service": "twilio"}

    await asyncio.gather(*[_run_one(c, npas) for c, npas in targets.items()])


# ── API Endpoints ─────────────────────────────────────────────────────────────

@router.get("/results")
async def list_results(
    country: Optional[str] = None,
    tier: Optional[str] = None,
    status: str = "available",
    _: str = Depends(get_tenant_id),
):
    db = get_db()
    q = (
        db.table("number_hunt_results")
        .select("*")
        .eq("status", status)
        .order("ai_score", desc=True, nulls_last=True)
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
    db = get_db()
    q = db.table("number_scan_runs").select("*").order("started_at", desc=True)
    if country:
        q = q.eq("country", country.upper())
    return q.limit(100).execute().data


@router.get("/status")
async def scan_status(_: str = Depends(get_tenant_id)):
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
    country = body.country.upper()
    if country not in NANP_COUNTRIES:
        raise HTTPException(status_code=400, detail=f"Unknown country '{country}'")
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
