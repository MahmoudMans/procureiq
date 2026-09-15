CREATE SEQUENCE procurement_strategic_value_case_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_strategic_value_review_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_strategic_value_cases (
    id UUID PRIMARY KEY,

    case_number
        VARCHAR(60)
        NOT NULL,

    persistence_plan_id
        UUID
        NOT NULL,

    persistence_plan_number
        VARCHAR(60)
        NOT NULL,

    commitment_id
        UUID
        NOT NULL,

    commitment_number
        VARCHAR(60)
        NOT NULL,

    roadmap_id
        UUID
        NOT NULL,

    roadmap_number
        VARCHAR(60)
        NOT NULL,

    initiative_number
        VARCHAR(60)
        NOT NULL,

    initiative_title
        VARCHAR(300)
        NOT NULL,

    value_owner_user_id
        UUID
        NOT NULL,

    value_owner_name_snapshot
        VARCHAR(300)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    step53_validated_contribution_points
        NUMERIC(9, 2)
        NOT NULL,

    persistence_baseline_points
        NUMERIC(9, 2)
        NOT NULL,

    investment_cost_amount
        NUMERIC(18, 2)
        NOT NULL,

    annual_operating_cost_amount
        NUMERIC(18, 2)
        NOT NULL,

    annualized_value_amount
        NUMERIC(18, 2)
        NOT NULL,

    value_horizon_months
        INTEGER
        NOT NULL,

    target_roi_pct
        NUMERIC(9, 2)
        NOT NULL,

    target_payback_months
        NUMERIC(9, 2)
        NOT NULL,

    valuation_note
        VARCHAR(5000)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    verification_note
        VARCHAR(5000),

    verified_by_user_id
        UUID,

    verified_at
        TIMESTAMPTZ,

    close_note
        VARCHAR(5000),

    closed_by_user_id
        UUID,

    closed_at
        TIMESTAMPTZ,

    created_by_user_id
        UUID
        NOT NULL,

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

    CONSTRAINT uk_strategic_value_case_number
        UNIQUE (
            case_number
        ),

    CONSTRAINT fk_strategic_value_persistence_plan
        FOREIGN KEY (
            persistence_plan_id
        )
        REFERENCES procurement_outcome_persistence_plans (id),

    CONSTRAINT fk_strategic_value_commitment
        FOREIGN KEY (
            commitment_id
        )
        REFERENCES procurement_strategy_execution_commitments (id),

    CONSTRAINT fk_strategic_value_roadmap
        FOREIGN KEY (
            roadmap_id
        )
        REFERENCES procurement_strategy_roadmaps (id),

    CONSTRAINT fk_strategic_value_owner
        FOREIGN KEY (
            value_owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_strategic_value_verifier
        FOREIGN KEY (
            verified_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_strategic_value_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_strategic_value_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategic_value_case_status
        CHECK (
            status IN (
                'ACTIVE',
                'READY_FOR_REVIEW',
                'VERIFIED',
                'CLOSED'
            )
        ),

    CONSTRAINT ck_strategic_value_source_points
        CHECK (
            step53_validated_contribution_points > 0
            AND
            step53_validated_contribution_points <= 100
            AND
            persistence_baseline_points > 0
            AND
            persistence_baseline_points <= 100
        ),

    CONSTRAINT ck_strategic_value_costs
        CHECK (
            investment_cost_amount > 0
            AND
            annual_operating_cost_amount >= 0
            AND
            annualized_value_amount >= 0
        ),

    CONSTRAINT ck_strategic_value_horizon
        CHECK (
            value_horizon_months
                BETWEEN 1 AND 600
        ),

    CONSTRAINT ck_strategic_value_roi_target
        CHECK (
            target_roi_pct
                BETWEEN -100 AND 10000
        ),

    CONSTRAINT ck_strategic_value_payback_target
        CHECK (
            target_payback_months
                BETWEEN 1 AND 600
        )
);

CREATE UNIQUE INDEX uk_strategic_value_active_persistence_plan
    ON procurement_strategic_value_cases (
        persistence_plan_id
    )
    WHERE status <> 'CLOSED';

CREATE TABLE procurement_strategic_value_reviews (
    id UUID PRIMARY KEY,

    review_number
        VARCHAR(60)
        NOT NULL,

    case_count
        INTEGER
        NOT NULL,

    verified_case_count
        INTEGER
        NOT NULL,

    at_risk_case_count
        INTEGER
        NOT NULL,

    watch_case_count
        INTEGER
        NOT NULL,

    strong_case_count
        INTEGER
        NOT NULL,

    total_investment_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_operating_cost_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_baseline_horizon_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_durable_horizon_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_decayed_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_cost_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    portfolio_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    portfolio_payback_months
        NUMERIC(12, 2),

    portfolio_health
        VARCHAR(20)
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_strategic_value_review_number
        UNIQUE (
            review_number
        ),

    CONSTRAINT fk_strategic_value_review_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategic_value_review_health
        CHECK (
            portfolio_health IN (
                'UNASSESSED',
                'STRONG',
                'HEALTHY',
                'WATCH',
                'AT_RISK'
            )
        )
);

CREATE TABLE procurement_strategic_value_review_items (
    id UUID PRIMARY KEY,

    review_id
        UUID
        NOT NULL,

    value_case_id
        UUID
        NOT NULL,

    case_number
        VARCHAR(60)
        NOT NULL,

    persistence_plan_number
        VARCHAR(60)
        NOT NULL,

    commitment_number
        VARCHAR(60)
        NOT NULL,

    initiative_number
        VARCHAR(60)
        NOT NULL,

    initiative_title
        VARCHAR(300)
        NOT NULL,

    value_owner_name
        VARCHAR(300)
        NOT NULL,

    case_status
        VARCHAR(30)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    investment_cost_amount
        NUMERIC(18, 2)
        NOT NULL,

    annual_operating_cost_amount
        NUMERIC(18, 2)
        NOT NULL,

    annualized_value_amount
        NUMERIC(18, 2)
        NOT NULL,

    persistence_pct
        NUMERIC(7, 2)
        NOT NULL,

    baseline_horizon_value_amount
        NUMERIC(18, 2)
        NOT NULL,

    durable_horizon_value_amount
        NUMERIC(18, 2)
        NOT NULL,

    decayed_value_amount
        NUMERIC(18, 2)
        NOT NULL,

    total_cost_amount
        NUMERIC(18, 2)
        NOT NULL,

    net_value_amount
        NUMERIC(18, 2)
        NOT NULL,

    roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    payback_months
        NUMERIC(12, 2),

    value_at_risk_amount
        NUMERIC(18, 2)
        NOT NULL,

    value_health
        VARCHAR(20)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_strategic_value_review_item_review
        FOREIGN KEY (
            review_id
        )
        REFERENCES procurement_strategic_value_reviews (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_strategic_value_case_status
    ON procurement_strategic_value_cases (
        status,
        fiscal_year,
        currency
    );

CREATE INDEX idx_strategic_value_case_commitment
    ON procurement_strategic_value_cases (
        commitment_id
    );

CREATE INDEX idx_strategic_value_review_capture
    ON procurement_strategic_value_reviews (
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_strategic_value_review_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement strategic value reviews are immutable';
END;
$$;

CREATE TRIGGER trg_strategic_value_review_immutable
BEFORE UPDATE OR DELETE
ON procurement_strategic_value_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_strategic_value_review_mutation();

CREATE TRIGGER trg_strategic_value_review_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_strategic_value_review_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_strategic_value_review_mutation();

CREATE TRIGGER trg_audit_strategic_value_cases
AFTER INSERT OR UPDATE
ON procurement_strategic_value_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_strategic_value_reviews
AFTER INSERT
ON procurement_strategic_value_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
