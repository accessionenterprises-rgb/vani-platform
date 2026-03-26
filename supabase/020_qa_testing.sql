-- QA Testing tables for automated agent quality analysis

CREATE TABLE IF NOT EXISTS qa_test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    agent_id UUID REFERENCES agents(id),
    status TEXT NOT NULL DEFAULT 'running',  -- running, completed, failed
    method TEXT NOT NULL DEFAULT 'chat',     -- chat, call
    scenario_count INTEGER DEFAULT 0,
    avg_score NUMERIC(3,1) DEFAULT 0,
    total_issues INTEGER DEFAULT 0,
    summary JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qa_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID NOT NULL REFERENCES qa_test_runs(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    agent_id UUID REFERENCES agents(id),
    scenario TEXT NOT NULL,
    turns JSONB DEFAULT '[]',
    scores JSONB DEFAULT '{}',
    overall_score NUMERIC(3,1) DEFAULT 0,
    issues TEXT[] DEFAULT '{}',
    transcript TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_runs_tenant ON qa_test_runs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_results_run ON qa_test_results(test_run_id);

-- Transcript analysis cache (one per agent per tenant)
CREATE TABLE IF NOT EXISTS qa_analyses (
    agent_id UUID NOT NULL,
    tenant_id TEXT NOT NULL,
    analysis JSONB DEFAULT '{}',
    calls_analyzed INTEGER DEFAULT 0,
    period_days INTEGER DEFAULT 7,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (agent_id, tenant_id)
);

-- RLS
ALTER TABLE qa_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_runs_tenant" ON qa_test_runs FOR ALL USING (tenant_id = auth.uid()::text);
CREATE POLICY "qa_results_tenant" ON qa_test_results FOR ALL USING (tenant_id = auth.uid()::text);

-- Service role bypass
ALTER TABLE qa_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_runs_service" ON qa_test_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "qa_results_service" ON qa_test_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "qa_analyses_service" ON qa_analyses FOR ALL USING (true) WITH CHECK (true);
