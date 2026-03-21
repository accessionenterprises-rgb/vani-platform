"""
Knowledge Base retriever — fetches relevant KB chunks during a call.

V1: Simple full-text injection (load all KB content for small KBs)
V2: pgvector cosine similarity search (activated when embeddings exist)

Usage:
    retriever = KBRetriever(agent_id, supabase_url, supabase_key)
    context = await retriever.get_context(user_query, max_chars=4000)
"""
import os
from typing import Optional

import httpx
import structlog

logger = structlog.get_logger()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
OPENAI_KEY   = os.getenv("OPENAI_API_KEY", "")

MAX_INLINE_CHARS = 6000   # include all KB if total content < this
MAX_CHUNKS       = 3      # top-N chunks for vector search


class KBRetriever:
    def __init__(self, agent_id: str):
        self._agent_id = agent_id
        self._docs: list[dict] = []      # loaded once at call start
        self._has_embeddings = False

    async def load(self) -> None:
        """Load all KB documents for the agent at call start."""
        if not SUPABASE_URL or not SUPABASE_KEY:
            return
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{SUPABASE_URL}/rest/v1/agent_kb",
                    params={"agent_id": f"eq.{self._agent_id}", "select": "id,filename,content,embedding"},
                    headers={
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                    },
                )
                if resp.status_code == 200:
                    self._docs = resp.json() or []
                    self._has_embeddings = any(d.get("embedding") for d in self._docs)
                    logger.info("kb_loaded", agent_id=self._agent_id, doc_count=len(self._docs))
        except Exception as e:
            logger.warning("kb_load_failed", agent_id=self._agent_id, error=str(e))

    async def get_context(self, query: Optional[str] = None, max_chars: int = 4000) -> str:
        """
        Return KB content to inject into LLM system prompt.
        - If total KB is small: return all content
        - If query provided + embeddings exist: semantic search
        - Otherwise: return first N chars of each document
        """
        if not self._docs:
            return ""

        total_chars = sum(len(d.get("content", "")) for d in self._docs)

        # Small KB: include everything
        if total_chars <= MAX_INLINE_CHARS:
            parts = []
            for doc in self._docs:
                content = (doc.get("content") or "").strip()
                if content:
                    parts.append(f"### {doc['filename']}\n{content}")
            return "\n\n".join(parts)[:max_chars]

        # Large KB with embeddings + query: semantic search
        if self._has_embeddings and query and OPENAI_KEY:
            chunks = await self._semantic_search(query)
            if chunks:
                return "\n\n".join(
                    f"### {c['filename']} (relevant excerpt)\n{c['content'][:1200]}"
                    for c in chunks
                )[:max_chars]

        # Fallback: first chunk of each doc
        parts = []
        budget = max_chars // max(len(self._docs), 1)
        for doc in self._docs:
            content = (doc.get("content") or "")[:budget]
            parts.append(f"### {doc['filename']}\n{content}")
        return "\n\n".join(parts)[:max_chars]

    async def _semantic_search(self, query: str) -> list[dict]:
        """Get query embedding from OpenAI, then find similar KB chunks via Supabase RPC."""
        try:
            # Get embedding for the query
            async with httpx.AsyncClient(timeout=10) as client:
                embed_resp = await client.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={"Authorization": f"Bearer {OPENAI_KEY}"},
                    json={"model": "text-embedding-3-small", "input": query},
                )
                if embed_resp.status_code != 200:
                    return []
                embedding = embed_resp.json()["data"][0]["embedding"]

                # Call Supabase pgvector RPC
                rpc_resp = await client.post(
                    f"{SUPABASE_URL}/rest/v1/rpc/match_kb_docs",
                    headers={
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "query_embedding": embedding,
                        "agent_filter": self._agent_id,
                        "match_count": MAX_CHUNKS,
                        "match_threshold": 0.5,
                    },
                )
                if rpc_resp.status_code == 200:
                    return rpc_resp.json() or []
        except Exception as e:
            logger.warning("kb_semantic_search_failed", error=str(e))
        return []
