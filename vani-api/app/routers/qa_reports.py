"""
QA Reports & Analytics — comprehensive call quality reporting.

Provides:
  - Per-agent quality scores over time
  - Call pattern analysis (peak hours, avg duration, drop-off rates)
  - Conversation issue detection (re-greeting, long responses, corporate talk)
  - Auto-generated improvement suggestions
  - Exportable reports
"""
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.config import settings
from app.db import get_db
from app.middleware.auth import get_tenant_id

logger = structlog.get_logger()

router = APIRouter(prefix="/qa/reports", tags=["QA Testing"])


# ── Agent Performance Overview ──────────────────────────────────

@router.get("/agent/{agent_id}/overview")
async def agent_overview(agent_id: str, days: int = Query(7, le=90), tenant_id: str = Depends(get_tenant_id)):
    """Full performance overview for an agent over N days."""
    db = get_db()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # Get calls
    calls = (
        db.table("calls")
        .select("id,status,direction,duration_sec,sentiment,started_at,ended_at,transcript")
        .eq("agent_id", agent_id)
        .eq("tenant_id", tenant_id)
        .gte("created_at", since)
        .order("created_at", desc=True)
        .execute()
    )
    rows = calls.data or []

    # Get QA test scores
    qa_runs = (
        db.table("qa_test_runs")
        .select("avg_score,created_at,summary")
        .eq("agent_id", agent_id)
        .eq("tenant_id", tenant_id)
        .eq("status", "completed")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .execute()
    )
    qa_data = qa_runs.data or []

    # Compute metrics
    total = len(rows)
    completed = [r for r in rows if r["status"] == "completed"]
    failed = [r for r in rows if r["status"] in ("failed", "missed")]
    inbound = [r for r in rows if r["direction"] == "inbound"]
    outbound = [r for r in rows if r["direction"] == "outbound"]

    durations = [r["duration_sec"] for r in completed if r.get("duration_sec")]
    avg_duration = sum(durations) / len(durations) if durations else 0
    max_duration = max(durations) if durations else 0
    min_duration = min(durations) if durations else 0

    # Sentiment breakdown
    sentiments = {}
    for r in rows:
        s = r.get("sentiment", "unknown") or "unknown"
        sentiments[s] = sentiments.get(s, 0) + 1

    # Completion rate
    completion_rate = len(completed) / total * 100 if total > 0 else 0

    # QA scores
    qa_scores = [r["avg_score"] for r in qa_data if r.get("avg_score")]
    avg_qa = sum(qa_scores) / len(qa_scores) if qa_scores else None

    # Peak hours
    hours = {}
    for r in rows:
        if r.get("started_at"):
            try:
                h = datetime.fromisoformat(str(r["started_at"])).hour
                hours[h] = hours.get(h, 0) + 1
            except Exception:
                pass
    peak_hour = max(hours, key=hours.get) if hours else None

    # Daily call volume
    daily = {}
    for r in rows:
        if r.get("started_at"):
            try:
                d = str(r["started_at"])[:10]
                daily[d] = daily.get(d, 0) + 1
            except Exception:
                pass

    return {
        "period_days": days,
        "total_calls": total,
        "completed": len(completed),
        "failed": len(failed),
        "inbound": len(inbound),
        "outbound": len(outbound),
        "completion_rate": round(completion_rate, 1),
        "avg_duration_sec": round(avg_duration),
        "max_duration_sec": max_duration,
        "min_duration_sec": min_duration,
        "sentiments": sentiments,
        "avg_qa_score": round(avg_qa, 1) if avg_qa else None,
        "qa_tests_run": len(qa_data),
        "peak_hour": peak_hour,
        "daily_volume": daily,
    }


# ── Transcript Analysis ────────────────────────────────────────

@router.post("/agent/{agent_id}/analyze-transcripts")
async def analyze_transcripts(agent_id: str, days: int = Query(7, le=30), tenant_id: str = Depends(get_tenant_id)):
    """Analyze recent call transcripts for quality issues. Uses LLM to detect patterns."""
    db = get_db()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    calls = (
        db.table("calls")
        .select("id,transcript,duration_sec,sentiment")
        .eq("agent_id", agent_id)
        .eq("tenant_id", tenant_id)
        .eq("status", "completed")
        .not_.is_("transcript", "null")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    rows = calls.data or []

    if not rows:
        return {"issues": [], "suggestions": [], "message": "No transcripts to analyze"}

    # Combine transcripts for batch analysis
    combined = ""
    for i, r in enumerate(rows[:10]):
        t = r.get("transcript", "")
        if t:
            combined += f"\n--- Call {i+1} (duration: {r.get('duration_sec', '?')}s) ---\n{t[:800]}\n"

    openai_key = os.getenv("OPENAI_API_KEY", "")
    if not openai_key:
        return {"issues": ["OpenAI key not configured"], "suggestions": []}

    prompt = f"""Analyze these voice AI call transcripts and identify patterns.

{combined}

For each issue found, specify:
1. What the problem is (be specific — quote the exact text)
2. How often it occurs (every call, sometimes, once)
3. Severity (high/medium/low)
4. Suggested fix

Also provide overall suggestions to improve the agent.

Respond with JSON only:
{{
  "issues": [
    {{"problem": "...", "example": "...", "frequency": "...", "severity": "...", "fix": "..."}}
  ],
  "suggestions": ["...", "..."],
  "overall_grade": "A/B/C/D/F",
  "summary": "1-2 sentence summary"
}}"""

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            r = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {openai_key}"},
                json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": prompt}], "max_tokens": 800},
            )
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
        start = text.find("{")
        end = text.rfind("}") + 1
        analysis = json.loads(text[start:end])

        # Save analysis
        db.table("qa_analyses").upsert({
            "agent_id": agent_id,
            "tenant_id": tenant_id,
            "analysis": analysis,
            "calls_analyzed": len(rows),
            "period_days": days,
        }, on_conflict="agent_id,tenant_id").execute()

        return analysis

    except Exception as e:
        logger.error("transcript_analysis_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")


# ── Call Quality Score per Call ──────────────────────────────────

@router.post("/call/{call_id}/score")
async def score_call(call_id: str, tenant_id: str = Depends(get_tenant_id)):
    """Score a single call's quality. Stores result on the call record."""
    db = get_db()

    call = (
        db.table("calls")
        .select("id,transcript,duration_sec")
        .eq("id", call_id)
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if not call.data:
        raise HTTPException(status_code=404, detail="Call not found")

    transcript = call.data.get("transcript", "")
    if not transcript or len(transcript) < 20:
        raise HTTPException(status_code=400, detail="No transcript available")

    openai_key = os.getenv("OPENAI_API_KEY", "")
    if not openai_key:
        raise HTTPException(status_code=500, detail="OpenAI key not configured")

    prompt = f"""Score this voice AI call transcript.

{transcript[:4000]}

Score 1-10 on each:
- naturalness: Does the AI sound human?
- helpfulness: Did it actually help the caller?
- conciseness: Were responses the right length?
- conversation_flow: Was it a natural back-and-forth?
- issue_resolution: Was the caller's need addressed?

List specific issues and what the agent should have said instead.

JSON only:
{{
  "naturalness": <1-10>,
  "helpfulness": <1-10>,
  "conciseness": <1-10>,
  "conversation_flow": <1-10>,
  "issue_resolution": <1-10>,
  "overall": <1-10>,
  "issues": [{{"problem": "...", "should_have_said": "..."}}],
  "summary": "..."
}}"""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {openai_key}"},
                json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": prompt}], "max_tokens": 500},
            )
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
        start = text.find("{")
        end = text.rfind("}") + 1
        scores = json.loads(text[start:end])

        # Save scores on the call
        db.table("calls").update({
            "metadata": {**(call.data.get("metadata") or {}), "qa_scores": scores},
            "sentiment": _derive_sentiment(scores.get("overall", 5)),
        }).eq("id", call_id).execute()

        return scores

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {e}")


def _derive_sentiment(score: int) -> str:
    if score >= 8: return "positive"
    if score >= 5: return "neutral"
    return "negative"


# ── Improvement Suggestions ─────────────────────────────────────

@router.get("/agent/{agent_id}/suggestions")
async def get_suggestions(agent_id: str, tenant_id: str = Depends(get_tenant_id)):
    """Get auto-generated improvement suggestions based on recent calls and QA tests."""
    db = get_db()

    # Get latest analysis
    analysis = (
        db.table("qa_analyses")
        .select("analysis,calls_analyzed,period_days,updated_at")
        .eq("agent_id", agent_id)
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )

    # Get latest QA test results
    latest_qa = (
        db.table("qa_test_results")
        .select("scenario,scores,issues,overall_score")
        .eq("agent_id", agent_id)
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    # Get agent config
    agent = (
        db.table("agents")
        .select("name,prompt,greeting,voice,llm_provider,tts_provider,language")
        .eq("id", agent_id)
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )

    suggestions = []
    agent_data = agent.data or {}

    # Check prompt length
    prompt = agent_data.get("prompt", "")
    if len(prompt) < 100:
        suggestions.append({
            "category": "prompt",
            "priority": "high",
            "suggestion": "Your agent prompt is very short. Add specific instructions about your business, services, and how to handle common questions.",
        })
    if "price" not in prompt.lower() and "cost" not in prompt.lower():
        suggestions.append({
            "category": "prompt",
            "priority": "medium",
            "suggestion": "Add pricing information to your prompt. Callers frequently ask about pricing and vague answers hurt trust.",
        })

    # Check voice
    if agent_data.get("tts_provider", "").startswith("openai"):
        suggestions.append({
            "category": "voice",
            "priority": "low",
            "suggestion": "Consider upgrading to Cartesia or ElevenLabs for more natural-sounding voice on phone calls.",
        })

    # Check QA scores
    qa_results = latest_qa.data or []
    low_scores = [r for r in qa_results if r.get("overall_score", 10) < 6]
    if low_scores:
        scenarios = [r["scenario"] for r in low_scores]
        suggestions.append({
            "category": "quality",
            "priority": "high",
            "suggestion": f"Agent scored below 6/10 on: {', '.join(scenarios)}. Review these scenarios and adjust the prompt.",
        })

    # From transcript analysis
    if analysis.data and analysis.data.get("analysis"):
        a = analysis.data["analysis"]
        for issue in a.get("issues", [])[:3]:
            if issue.get("severity") in ("high", "medium"):
                suggestions.append({
                    "category": "conversation",
                    "priority": issue["severity"],
                    "suggestion": f"{issue['problem']} — Fix: {issue.get('fix', 'Review prompt')}",
                })

    # Check KB
    kb_count = db.table("knowledge_base").select("id", count="exact").eq("agent_id", agent_id).execute()
    if (kb_count.count or 0) == 0:
        suggestions.append({
            "category": "knowledge",
            "priority": "high",
            "suggestion": "No knowledge base documents uploaded. Add FAQs, pricing, and service details so the agent can give accurate answers.",
        })

    return {
        "agent_id": agent_id,
        "suggestions": suggestions,
        "last_analysis": analysis.data.get("updated_at") if analysis.data else None,
        "qa_tests_available": len(qa_results),
    }


# ── Comparison Report ───────────────────────────────────────────

@router.get("/agent/{agent_id}/trend")
async def quality_trend(agent_id: str, days: int = Query(30, le=90), tenant_id: str = Depends(get_tenant_id)):
    """Quality score trend over time."""
    db = get_db()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # QA test scores over time
    qa = (
        db.table("qa_test_runs")
        .select("avg_score,created_at")
        .eq("agent_id", agent_id)
        .eq("tenant_id", tenant_id)
        .eq("status", "completed")
        .gte("created_at", since)
        .order("created_at")
        .execute()
    )

    # Call volume + duration trend
    calls = (
        db.table("calls")
        .select("duration_sec,status,created_at")
        .eq("agent_id", agent_id)
        .eq("tenant_id", tenant_id)
        .gte("created_at", since)
        .order("created_at")
        .execute()
    )

    # Group by day
    daily_qa = {}
    for r in (qa.data or []):
        d = str(r["created_at"])[:10]
        if d not in daily_qa:
            daily_qa[d] = []
        daily_qa[d].append(r["avg_score"])

    daily_calls = {}
    for r in (calls.data or []):
        d = str(r["created_at"])[:10]
        if d not in daily_calls:
            daily_calls[d] = {"total": 0, "completed": 0, "avg_duration": []}
        daily_calls[d]["total"] += 1
        if r["status"] == "completed":
            daily_calls[d]["completed"] += 1
            if r.get("duration_sec"):
                daily_calls[d]["avg_duration"].append(r["duration_sec"])

    # Build timeline
    timeline = []
    for d in sorted(set(list(daily_qa.keys()) + list(daily_calls.keys()))):
        entry = {"date": d}
        if d in daily_qa:
            entry["qa_score"] = round(sum(daily_qa[d]) / len(daily_qa[d]), 1)
        if d in daily_calls:
            c = daily_calls[d]
            entry["calls"] = c["total"]
            entry["completed"] = c["completed"]
            entry["avg_duration"] = round(sum(c["avg_duration"]) / len(c["avg_duration"])) if c["avg_duration"] else 0
        timeline.append(entry)

    return {"period_days": days, "timeline": timeline}
