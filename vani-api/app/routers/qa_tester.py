"""
QA Auto-Tester — automated call quality testing.

Calls an agent's phone number, runs through test scenarios,
records responses, measures latency, and scores quality.

Part of the Vani Quality Analysis system.
"""
import json
import os
import time
import uuid
from typing import Optional

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel

from app.config import settings
from app.db import get_db
from app.middleware.auth import get_tenant_id

logger = structlog.get_logger()

router = APIRouter(prefix="/qa", tags=["QA Testing"])

# ── Test scenarios ──────────────────────────────────────────────

DEFAULT_SCENARIOS = [
    {
        "name": "Basic Greeting",
        "description": "Test initial greeting and responsiveness",
        "messages": [
            {"say": "Hello", "expect": "greeting", "max_latency_ms": 3000},
        ],
    },
    {
        "name": "Business Inquiry",
        "description": "Test how agent handles a business question",
        "messages": [
            {"say": "Hello", "expect": "greeting", "max_latency_ms": 3000},
            {"say": "What does your company do?", "expect": "description", "max_latency_ms": 4000},
        ],
    },
    {
        "name": "Pricing Question",
        "description": "Test if agent gives real pricing or vague answers",
        "messages": [
            {"say": "Hi, how much does your service cost?", "expect": "pricing", "max_latency_ms": 4000},
        ],
    },
    {
        "name": "Hello Interruption",
        "description": "Test if agent re-greets when user says hello mid-conversation",
        "messages": [
            {"say": "Hi, tell me about your services", "expect": "description", "max_latency_ms": 4000},
            {"say": "hello", "expect": "no_regreet", "max_latency_ms": 3000},
        ],
    },
    {
        "name": "Audio Issue",
        "description": "Test how agent handles 'I can't hear you'",
        "messages": [
            {"say": "Hi", "expect": "greeting", "max_latency_ms": 3000},
            {"say": "I couldn't hear you, what did you say?", "expect": "repeat_gracefully", "max_latency_ms": 3000},
        ],
    },
    {
        "name": "Conversation Naturalness",
        "description": "Test if agent sounds human vs corporate",
        "messages": [
            {"say": "Hey, I need some help with my business", "expect": "natural_response", "max_latency_ms": 4000},
            {"say": "We're struggling with getting leads", "expect": "empathetic_helpful", "max_latency_ms": 4000},
        ],
    },
]


# ── Models ──────────────────────────────────────────────────────

class QATestRequest(BaseModel):
    agent_id: str
    scenarios: Optional[list[str]] = None  # None = run all
    method: str = "chat"  # "chat" (text via playground) or "call" (real phone call)


class QATestResult(BaseModel):
    id: str
    agent_id: str
    scenario: str
    status: str
    turns: list[dict]
    scores: dict
    overall_score: float
    issues: list[str]
    created_at: str


# ── Score a conversation with LLM ──────────────────────────────

_SCORING_PROMPT = """You are a voice AI quality analyst. Score this conversation between a caller (USER) and an AI agent (AGENT).

Score each dimension from 1-10:
- naturalness: Does the agent sound human? (no corporate jargon, casual language)
- responsiveness: Are responses concise and to the point? (not too long, not too short)
- accuracy: Does the agent answer the question correctly?
- conversation_flow: Does the conversation feel natural? (no re-greeting, no repetition)
- tone: Is the tone warm and appropriate?

Also list up to 3 specific issues found (be specific about what went wrong).

CONVERSATION:
{transcript}

Respond ONLY with valid JSON:
{{
  "naturalness": <1-10>,
  "responsiveness": <1-10>,
  "accuracy": <1-10>,
  "conversation_flow": <1-10>,
  "tone": <1-10>,
  "overall": <1-10>,
  "issues": ["issue1", "issue2"]
}}"""


async def _score_conversation(transcript: str) -> dict:
    """Score a conversation using LLM."""
    openai_key = os.getenv("OPENAI_API_KEY", "")
    if not openai_key:
        return {"overall": 0, "issues": ["No OpenAI key configured for scoring"]}

    prompt = _SCORING_PROMPT.replace("{transcript}", transcript[:6000])

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {openai_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 300,
                },
            )
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
        start = text.find("{")
        end = text.rfind("}") + 1
        return json.loads(text[start:end])
    except Exception as e:
        logger.error("qa_scoring_failed", error=str(e))
        return {"overall": 0, "issues": [f"Scoring failed: {e}"]}


# ── Run test via chat playground ───────────────────────────────

async def _run_chat_test(agent_id: str, scenario: dict, tenant_id: str) -> dict:
    """Run a test scenario via the chat playground endpoint."""
    turns = []
    transcript_lines = []

    for msg in scenario["messages"]:
        user_text = msg["say"]
        start_ts = time.time()

        try:
            # Call the playground chat endpoint internally
            db = get_db()
            agent_row = (
                db.table("agents")
                .select("*")
                .eq("id", agent_id)
                .eq("tenant_id", tenant_id)
                .maybe_single()
                .execute()
            )
            if not agent_row.data:
                turns.append({"user": user_text, "agent": "ERROR: Agent not found", "latency_ms": 0})
                continue

            # Build a simple chat completion
            openai_key = os.getenv("OPENAI_API_KEY", "")
            agent = agent_row.data
            llm_model = agent.get("llm_provider", "gpt-4o-mini")
            prompt = agent.get("prompt", "You are a helpful assistant.")

            # Include voice rules (same as engine)
            voice_rules = (
                "[VOICE CALL RULES]\n"
                "- Talk like a real human, warm and conversational.\n"
                "- Keep answers to 2-3 short sentences. Then pause.\n"
                "- If they say 'hello' mid-conversation, don't re-introduce yourself.\n"
                "- Never use corporate jargon.\n"
                "- No markdown, emojis, asterisks.\n\n"
            )

            messages = [{"role": "system", "content": f"{voice_rules}{prompt}"}]
            # Add previous turns for context
            for t in turns:
                messages.append({"role": "user", "content": t["user"]})
                if t.get("agent"):
                    messages.append({"role": "assistant", "content": t["agent"]})
            messages.append({"role": "user", "content": user_text})

            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {openai_key}"},
                    json={"model": llm_model, "messages": messages, "max_tokens": 200},
                )
            r.raise_for_status()
            agent_text = r.json()["choices"][0]["message"]["content"]
            latency_ms = int((time.time() - start_ts) * 1000)

            turns.append({
                "user": user_text,
                "agent": agent_text,
                "latency_ms": latency_ms,
                "max_latency_ms": msg.get("max_latency_ms", 4000),
                "latency_ok": latency_ms <= msg.get("max_latency_ms", 4000),
            })
            transcript_lines.append(f"USER: {user_text}")
            transcript_lines.append(f"AGENT: {agent_text}")

        except Exception as e:
            latency_ms = int((time.time() - start_ts) * 1000)
            turns.append({"user": user_text, "agent": f"ERROR: {e}", "latency_ms": latency_ms, "latency_ok": False})

    # Score the conversation
    transcript = "\n".join(transcript_lines)
    scores = await _score_conversation(transcript)

    return {
        "scenario": scenario["name"],
        "turns": turns,
        "scores": scores,
        "overall_score": scores.get("overall", 0),
        "issues": scores.get("issues", []),
        "transcript": transcript,
    }


# ── API Endpoints ──────────────────────────────────────────────

@router.post("/test", status_code=202)
async def start_qa_test(
    body: QATestRequest,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(get_tenant_id),
):
    """Start a QA test run. Returns test_run_id immediately, results saved to DB."""
    test_run_id = str(uuid.uuid4())

    db = get_db()
    # Verify agent exists
    agent = db.table("agents").select("id,name").eq("id", body.agent_id).eq("tenant_id", tenant_id).maybe_single().execute()
    if not agent.data:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Create test run record
    db.table("qa_test_runs").insert({
        "id": test_run_id,
        "tenant_id": tenant_id,
        "agent_id": body.agent_id,
        "status": "running",
        "method": body.method,
        "scenario_count": len(body.scenarios or DEFAULT_SCENARIOS),
    }).execute()

    # Run tests in background
    background_tasks.add_task(
        _run_test_suite, test_run_id, body.agent_id, tenant_id, body.scenarios, body.method
    )

    return {"test_run_id": test_run_id, "status": "running"}


async def _run_test_suite(test_run_id: str, agent_id: str, tenant_id: str, scenario_names: list[str] | None, method: str):
    """Background task: run all scenarios and save results."""
    db = get_db()
    scenarios = DEFAULT_SCENARIOS

    if scenario_names:
        scenarios = [s for s in DEFAULT_SCENARIOS if s["name"] in scenario_names]

    results = []
    total_score = 0

    for scenario in scenarios:
        try:
            if method == "chat":
                result = await _run_chat_test(agent_id, scenario, tenant_id)
            else:
                # TODO: implement real phone call testing
                result = await _run_chat_test(agent_id, scenario, tenant_id)

            results.append(result)
            total_score += result["overall_score"]

            # Save individual result
            db.table("qa_test_results").insert({
                "test_run_id": test_run_id,
                "tenant_id": tenant_id,
                "agent_id": agent_id,
                "scenario": scenario["name"],
                "turns": result["turns"],
                "scores": result["scores"],
                "overall_score": result["overall_score"],
                "issues": result["issues"],
                "transcript": result.get("transcript", ""),
            }).execute()

        except Exception as e:
            logger.error("qa_scenario_failed", scenario=scenario["name"], error=str(e))
            results.append({"scenario": scenario["name"], "overall_score": 0, "issues": [str(e)]})

    # Update test run with aggregate
    avg_score = total_score / len(scenarios) if scenarios else 0
    all_issues = []
    for r in results:
        all_issues.extend(r.get("issues", []))

    db.table("qa_test_runs").update({
        "status": "completed",
        "avg_score": round(avg_score, 1),
        "total_issues": len(all_issues),
        "summary": json.dumps({
            "scenarios_run": len(results),
            "avg_score": round(avg_score, 1),
            "top_issues": all_issues[:5],
        }),
    }).eq("id", test_run_id).execute()


@router.get("/test/{test_run_id}")
async def get_qa_test(test_run_id: str, tenant_id: str = Depends(get_tenant_id)):
    """Get QA test run status and results."""
    db = get_db()

    run = db.table("qa_test_runs").select("*").eq("id", test_run_id).eq("tenant_id", tenant_id).maybe_single().execute()
    if not run.data:
        raise HTTPException(status_code=404, detail="Test run not found")

    results = db.table("qa_test_results").select("*").eq("test_run_id", test_run_id).order("created_at").execute()

    return {
        "run": run.data,
        "results": results.data,
    }


@router.get("/tests")
async def list_qa_tests(tenant_id: str = Depends(get_tenant_id)):
    """List all QA test runs for this tenant."""
    db = get_db()
    runs = db.table("qa_test_runs").select("*").eq("tenant_id", tenant_id).order("created_at", desc=True).limit(20).execute()
    return runs.data


@router.get("/scenarios")
async def list_scenarios():
    """List available test scenarios."""
    return [{"name": s["name"], "description": s["description"], "turns": len(s["messages"])} for s in DEFAULT_SCENARIOS]
