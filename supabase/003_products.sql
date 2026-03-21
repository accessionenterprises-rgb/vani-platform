-- Agent Products — kiosk product showcase
-- Each agent can have a product catalog.
-- When the LLM calls __show_product, the kiosk displays the product image/details.

CREATE TABLE IF NOT EXISTS agent_products (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id    UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    image_url   TEXT,
    keywords    TEXT[]      DEFAULT '{}',   -- trigger words LLM uses to identify this product
    sort_order  INT         DEFAULT 0,
    active      BOOLEAN     DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_products_agent ON agent_products(agent_id);
