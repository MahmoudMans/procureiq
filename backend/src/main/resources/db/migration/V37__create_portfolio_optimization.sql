CREATE SEQUENCE procurement_portfolio_scenario_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_portfolio_scenarios (
    id UUID PRIMARY KEY,

    scenario_code
        VARCHAR(50)
        NOT NULL,

    name
        VARCHAR(240)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    owner_user_id
        UUID
        NOT NULL,

    budget_limit
        NUMERIC(19, 2)
        NOT NULL,

    max_initiatives
        INTEGER
        NOT NULL,

    max_average_risk_score
        NUMERIC(6, 2)
        NOT NULL,

    min_total_target_savings
        NUMERIC(19, 2)
        NOT NULL,

    allow_critical_priority
        BOOLEAN
        NOT NULL,

    notes
        VARCHAR(3000),

    evaluated_at
        TIMESTAMPTZ,

    approved_at
        TIMESTAMPTZ,

    approved_by_user_id
        UUID,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    version
        BIGINT
        NOT NULL
        DEFAULT 0,

    CONSTRAINT uk_procurement_portfolio_scenario_code
        UNIQUE (
            scenario_code
        ),

    CONSTRAINT fk_portfolio_scenario_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_portfolio_scenario_approver
        FOREIGN KEY (
            approved_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_portfolio_scenario_status
        CHECK (
            status IN (
                'DRAFT',
                'EVALUATED',
                'APPROVED',
                'ARCHIVED'
            )
        ),

    CONSTRAINT ck_portfolio_scenario_budget
        CHECK (
            budget_limit > 0
        ),

    CONSTRAINT ck_portfolio_scenario_max_initiatives
        CHECK (
            max_initiatives
                BETWEEN 1 AND 100
        ),

    CONSTRAINT ck_portfolio_scenario_risk
        CHECK (
            max_average_risk_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_portfolio_scenario_savings
        CHECK (
            min_total_target_savings
                >= 0
        )
);

CREATE TABLE procurement_portfolio_scenario_items (
    id UUID PRIMARY KEY,

    scenario_id
        UUID
        NOT NULL,

    initiative_id
        UUID
        NOT NULL,

    initiative_number
        VARCHAR(50)
        NOT NULL,

    category_name
        VARCHAR(180)
        NOT NULL,

    initiative_title
        VARCHAR(240)
        NOT NULL,

    initiative_type
        VARCHAR(50)
        NOT NULL,

    priority
        VARCHAR(20)
        NOT NULL,

    matrix_position
        VARCHAR(40)
        NOT NULL,

    decision
        VARCHAR(20)
        NOT NULL,

    rank_position
        INTEGER,

    estimated_value
        NUMERIC(19, 2)
        NOT NULL,

    target_savings
        NUMERIC(19, 2)
        NOT NULL,

    savings_efficiency_pct
        NUMERIC(7, 2)
        NOT NULL,

    strategic_value_score
        NUMERIC(6, 2)
        NOT NULL,

    supply_risk_score
        NUMERIC(6, 2)
        NOT NULL,

    priority_score
        NUMERIC(6, 2)
        NOT NULL,

    matrix_urgency_score
        NUMERIC(6, 2)
        NOT NULL,

    utility_score
        NUMERIC(6, 2)
        NOT NULL,

    exclusion_reason
        VARCHAR(1000),

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_portfolio_scenario_item_scenario
        FOREIGN KEY (
            scenario_id
        )
        REFERENCES procurement_portfolio_scenarios (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_portfolio_scenario_item_initiative
        FOREIGN KEY (
            initiative_id
        )
        REFERENCES procurement_category_initiatives (id),

    CONSTRAINT uk_portfolio_scenario_item
        UNIQUE (
            scenario_id,
            initiative_id
        ),

    CONSTRAINT ck_portfolio_scenario_item_decision
        CHECK (
            decision IN (
                'SELECTED',
                'EXCLUDED'
            )
        ),

    CONSTRAINT ck_portfolio_scenario_item_scores
        CHECK (
            savings_efficiency_pct
                BETWEEN 0 AND 100
            AND strategic_value_score
                BETWEEN 0 AND 100
            AND supply_risk_score
                BETWEEN 0 AND 100
            AND priority_score
                BETWEEN 0 AND 100
            AND matrix_urgency_score
                BETWEEN 0 AND 100
            AND utility_score
                BETWEEN 0 AND 100
        )
);

CREATE INDEX idx_portfolio_scenario_scope
    ON procurement_portfolio_scenarios (
        currency,
        status,
        updated_at DESC
    );

CREATE INDEX idx_portfolio_scenario_owner
    ON procurement_portfolio_scenarios (
        owner_user_id,
        status
    );

CREATE INDEX idx_portfolio_scenario_item_scenario
    ON procurement_portfolio_scenario_items (
        scenario_id,
        decision,
        rank_position
    );

CREATE INDEX idx_portfolio_scenario_item_initiative
    ON procurement_portfolio_scenario_items (
        initiative_id,
        scenario_id
    );

CREATE TRIGGER trg_audit_procurement_portfolio_scenarios
AFTER INSERT OR UPDATE OR DELETE
ON procurement_portfolio_scenarios
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
