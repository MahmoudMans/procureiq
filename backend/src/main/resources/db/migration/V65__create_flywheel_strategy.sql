CREATE SEQUENCE procurement_flywheel_strategy_portfolio_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_flywheel_strategy_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;


CREATE TABLE procurement_flywheel_strategy_portfolios (
    id UUID PRIMARY KEY,

    portfolio_number VARCHAR(60) NOT NULL,
    title VARCHAR(300) NOT NULL,

    currency VARCHAR(3) NOT NULL,
    fiscal_year INTEGER NOT NULL,

    capital_capacity_amount NUMERIC(20, 2) NOT NULL,

    portfolio_owner_user_id UUID NOT NULL,
    portfolio_owner_name_snapshot VARCHAR(300) NOT NULL,

    strategic_objective VARCHAR(5000) NOT NULL,

    status VARCHAR(30) NOT NULL,

    approved_by_user_id UUID,
    approved_at TIMESTAMPTZ,
    approval_note VARCHAR(5000),

    closed_by_user_id UUID,
    closed_at TIMESTAMPTZ,
    close_note VARCHAR(5000),

    created_by_user_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT uk_flywheel_strategy_portfolio_number
        UNIQUE (portfolio_number),

    CONSTRAINT fk_flywheel_strategy_portfolio_owner
        FOREIGN KEY (portfolio_owner_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_strategy_portfolio_approver
        FOREIGN KEY (approved_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_strategy_portfolio_closer
        FOREIGN KEY (closed_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_strategy_portfolio_creator
        FOREIGN KEY (created_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_flywheel_strategy_currency
        CHECK (currency ~ '^[A-Z]{3}$'),

    CONSTRAINT ck_flywheel_strategy_fiscal_year
        CHECK (fiscal_year BETWEEN 2000 AND 2200),

    CONSTRAINT ck_flywheel_strategy_capacity
        CHECK (capital_capacity_amount > 0),

    CONSTRAINT ck_flywheel_strategy_status
        CHECK (
            status IN (
                'DRAFT',
                'IN_REVIEW',
                'APPROVED',
                'CLOSED'
            )
        )
);


CREATE TABLE procurement_flywheel_strategy_items (
    id UUID PRIMARY KEY,

    portfolio_id UUID NOT NULL,

    flywheel_lineage_id UUID NOT NULL,
    lineage_number VARCHAR(60) NOT NULL,

    root_target_value_case_id UUID NOT NULL,
    root_target_value_case_number VARCHAR(60) NOT NULL,
    root_target_initiative_title VARCHAR(300) NOT NULL,

    lineage_root_fiscal_year INTEGER NOT NULL,
    lineage_cycle_count INTEGER NOT NULL,

    lineage_original_capital_amount NUMERIC(20, 2) NOT NULL,
    reference_next_cycle_capital_amount NUMERIC(20, 2) NOT NULL,
    proposed_capacity_amount NUMERIC(20, 2) NOT NULL,

    cumulative_projected_net_value_amount NUMERIC(20, 2) NOT NULL,
    cumulative_compounding_value_amount NUMERIC(20, 2) NOT NULL,
    cumulative_decayed_value_amount NUMERIC(20, 2) NOT NULL,

    cumulative_value_multiple NUMERIC(14, 4) NOT NULL,
    latest_marginal_value_multiple NUMERIC(14, 4) NOT NULL,
    latest_marginal_net_value_retention_pct NUMERIC(9, 2) NOT NULL,

    diminishing_returns BOOLEAN NOT NULL,

    flywheel_health VARCHAR(30) NOT NULL,
    step66_recommendation VARCHAR(20) NOT NULL,

    priority_score NUMERIC(7, 2) NOT NULL,
    advisory_recommendation VARCHAR(20) NOT NULL,

    decision VARCHAR(20) NOT NULL,
    decision_note VARCHAR(5000),

    decided_by_user_id UUID,
    decided_at TIMESTAMPTZ,

    added_by_user_id UUID NOT NULL,
    added_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT uk_flywheel_strategy_item_lineage
        UNIQUE (
            portfolio_id,
            flywheel_lineage_id
        ),

    CONSTRAINT fk_flywheel_strategy_item_portfolio
        FOREIGN KEY (portfolio_id)
        REFERENCES procurement_flywheel_strategy_portfolios (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_flywheel_strategy_item_lineage
        FOREIGN KEY (flywheel_lineage_id)
        REFERENCES procurement_capital_flywheel_lineages (id),

    CONSTRAINT fk_flywheel_strategy_item_root_target
        FOREIGN KEY (root_target_value_case_id)
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_flywheel_strategy_item_decider
        FOREIGN KEY (decided_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_strategy_item_adder
        FOREIGN KEY (added_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_flywheel_strategy_item_capital
        CHECK (
            lineage_original_capital_amount > 0
            AND reference_next_cycle_capital_amount > 0
            AND proposed_capacity_amount > 0
            AND proposed_capacity_amount
                <= reference_next_cycle_capital_amount
        ),

    CONSTRAINT ck_flywheel_strategy_item_score
        CHECK (
            priority_score BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_flywheel_strategy_item_health
        CHECK (
            flywheel_health IN (
                'SINGLE_CYCLE',
                'COMPOUNDING',
                'HEALTHY',
                'DIMINISHING',
                'EXHAUSTED'
            )
        ),

    CONSTRAINT ck_flywheel_strategy_item_step66_recommendation
        CHECK (
            step66_recommendation IN (
                'CONTINUE',
                'HOLD',
                'STOP'
            )
        ),

    CONSTRAINT ck_flywheel_strategy_item_advisory
        CHECK (
            advisory_recommendation IN (
                'PRIORITIZE',
                'HOLD',
                'EXIT'
            )
        ),

    CONSTRAINT ck_flywheel_strategy_item_decision
        CHECK (
            decision IN (
                'PENDING',
                'PRIORITIZE',
                'HOLD',
                'EXIT'
            )
        )
);


CREATE TABLE procurement_flywheel_strategy_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number VARCHAR(60) NOT NULL,

    portfolio_id UUID NOT NULL,
    portfolio_number VARCHAR(60) NOT NULL,

    currency VARCHAR(3) NOT NULL,
    fiscal_year INTEGER NOT NULL,

    portfolio_status VARCHAR(30) NOT NULL,

    capital_capacity_amount NUMERIC(20, 2) NOT NULL,

    item_count INTEGER NOT NULL,
    prioritize_count INTEGER NOT NULL,
    hold_count INTEGER NOT NULL,
    exit_count INTEGER NOT NULL,
    pending_count INTEGER NOT NULL,

    prioritized_capacity_amount NUMERIC(20, 2) NOT NULL,
    remaining_capacity_amount NUMERIC(20, 2) NOT NULL,

    capacity_utilization_pct NUMERIC(7, 2) NOT NULL,
    average_priority_score NUMERIC(7, 2) NOT NULL,

    captured_by_user_id UUID NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT uk_flywheel_strategy_snapshot_number
        UNIQUE (snapshot_number),

    CONSTRAINT fk_flywheel_strategy_snapshot_portfolio
        FOREIGN KEY (portfolio_id)
        REFERENCES procurement_flywheel_strategy_portfolios (id),

    CONSTRAINT fk_flywheel_strategy_snapshot_user
        FOREIGN KEY (captured_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_flywheel_strategy_snapshot_utilization
        CHECK (
            capacity_utilization_pct BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_flywheel_strategy_snapshot_score
        CHECK (
            average_priority_score BETWEEN 0 AND 100
        )
);


CREATE TABLE procurement_flywheel_strategy_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id UUID NOT NULL,

    flywheel_lineage_id UUID NOT NULL,
    lineage_number VARCHAR(60) NOT NULL,

    root_target_initiative_title VARCHAR(300) NOT NULL,

    proposed_capacity_amount NUMERIC(20, 2) NOT NULL,
    cumulative_projected_net_value_amount NUMERIC(20, 2) NOT NULL,

    cumulative_value_multiple NUMERIC(14, 4) NOT NULL,
    latest_marginal_value_multiple NUMERIC(14, 4) NOT NULL,
    latest_marginal_net_value_retention_pct NUMERIC(9, 2) NOT NULL,

    diminishing_returns BOOLEAN NOT NULL,

    flywheel_health VARCHAR(30) NOT NULL,
    step66_recommendation VARCHAR(20) NOT NULL,

    priority_score NUMERIC(7, 2) NOT NULL,
    advisory_recommendation VARCHAR(20) NOT NULL,

    decision VARCHAR(20) NOT NULL,
    decision_note VARCHAR(5000),

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_flywheel_strategy_snapshot_item_snapshot
        FOREIGN KEY (snapshot_id)
        REFERENCES procurement_flywheel_strategy_snapshots (id)
        ON DELETE CASCADE
);


CREATE INDEX idx_flywheel_strategy_portfolio_status
    ON procurement_flywheel_strategy_portfolios (
        status,
        fiscal_year,
        currency
    );

CREATE INDEX idx_flywheel_strategy_item_portfolio
    ON procurement_flywheel_strategy_items (
        portfolio_id,
        decision,
        priority_score DESC
    );

CREATE INDEX idx_flywheel_strategy_item_lineage
    ON procurement_flywheel_strategy_items (
        flywheel_lineage_id
    );

CREATE INDEX idx_flywheel_strategy_snapshot_capture
    ON procurement_flywheel_strategy_snapshots (
        portfolio_id,
        captured_at DESC
    );


CREATE OR REPLACE FUNCTION procureiq_prevent_flywheel_strategy_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement flywheel strategy snapshot evidence is immutable';
END;
$$;


CREATE TRIGGER trg_flywheel_strategy_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_flywheel_strategy_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_flywheel_strategy_snapshot_mutation();

CREATE TRIGGER trg_flywheel_strategy_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_flywheel_strategy_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_flywheel_strategy_snapshot_mutation();


CREATE TRIGGER trg_audit_flywheel_strategy_portfolios
AFTER INSERT OR UPDATE
ON procurement_flywheel_strategy_portfolios
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_flywheel_strategy_items
AFTER INSERT OR UPDATE
ON procurement_flywheel_strategy_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_flywheel_strategy_snapshots
AFTER INSERT
ON procurement_flywheel_strategy_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
