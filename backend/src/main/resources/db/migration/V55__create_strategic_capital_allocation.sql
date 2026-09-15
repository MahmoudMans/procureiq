CREATE SEQUENCE procurement_capital_allocation_cycle_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_capital_allocation_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_capital_allocation_cycles (
    id UUID PRIMARY KEY,

    cycle_number
        VARCHAR(60)
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    budget_amount
        NUMERIC(20, 2)
        NOT NULL,

    objective
        VARCHAR(5000)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    approved_by_user_id
        UUID,

    approved_at
        TIMESTAMPTZ,

    approval_note
        VARCHAR(5000),

    closed_by_user_id
        UUID,

    closed_at
        TIMESTAMPTZ,

    close_note
        VARCHAR(5000),

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

    CONSTRAINT uk_capital_allocation_cycle_number
        UNIQUE (
            cycle_number
        ),

    CONSTRAINT fk_capital_allocation_cycle_approver
        FOREIGN KEY (
            approved_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_capital_allocation_cycle_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_capital_allocation_cycle_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capital_allocation_cycle_currency
        CHECK (
            char_length(currency) = 3
        ),

    CONSTRAINT ck_capital_allocation_cycle_budget
        CHECK (
            budget_amount > 0
        ),

    CONSTRAINT ck_capital_allocation_cycle_status
        CHECK (
            status IN (
                'DRAFT',
                'IN_REVIEW',
                'APPROVED',
                'CLOSED'
            )
        )
);

CREATE TABLE procurement_capital_allocation_items (
    id UUID PRIMARY KEY,

    cycle_id
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

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    requested_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    investment_cost_snapshot
        NUMERIC(20, 2)
        NOT NULL,

    durable_horizon_value_snapshot
        NUMERIC(20, 2)
        NOT NULL,

    net_value_snapshot
        NUMERIC(20, 2)
        NOT NULL,

    roi_pct_snapshot
        NUMERIC(12, 2)
        NOT NULL,

    payback_months_snapshot
        NUMERIC(12, 2),

    persistence_pct_snapshot
        NUMERIC(7, 2)
        NOT NULL,

    value_health_snapshot
        VARCHAR(20)
        NOT NULL,

    priority_score
        NUMERIC(7, 2)
        NOT NULL,

    recommendation
        VARCHAR(20)
        NOT NULL,

    decision
        VARCHAR(20)
        NOT NULL,

    decision_note
        VARCHAR(5000),

    decided_by_user_id
        UUID,

    decided_at
        TIMESTAMPTZ,

    created_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_capital_allocation_item_cycle
        FOREIGN KEY (
            cycle_id
        )
        REFERENCES procurement_capital_allocation_cycles (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_capital_allocation_item_value_case
        FOREIGN KEY (
            value_case_id
        )
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_capital_allocation_item_decider
        FOREIGN KEY (
            decided_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_capital_allocation_item_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_capital_allocation_cycle_value_case
        UNIQUE (
            cycle_id,
            value_case_id
        ),

    CONSTRAINT ck_capital_allocation_requested_capital
        CHECK (
            requested_capital_amount > 0
        ),

    CONSTRAINT ck_capital_allocation_priority_score
        CHECK (
            priority_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_capital_allocation_recommendation
        CHECK (
            recommendation IN (
                'FUND',
                'DEFER',
                'REJECT'
            )
        ),

    CONSTRAINT ck_capital_allocation_decision
        CHECK (
            decision IN (
                'PENDING',
                'FUND',
                'DEFER',
                'REJECT'
            )
        ),

    CONSTRAINT ck_capital_allocation_item_health
        CHECK (
            value_health_snapshot IN (
                'UNASSESSED',
                'STRONG',
                'HEALTHY',
                'WATCH',
                'AT_RISK'
            )
        )
);

CREATE TABLE procurement_capital_allocation_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number
        VARCHAR(60)
        NOT NULL,

    cycle_id
        UUID
        NOT NULL,

    cycle_number
        VARCHAR(60)
        NOT NULL,

    cycle_title
        VARCHAR(300)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    cycle_status
        VARCHAR(30)
        NOT NULL,

    budget_amount
        NUMERIC(20, 2)
        NOT NULL,

    funded_amount
        NUMERIC(20, 2)
        NOT NULL,

    remaining_budget_amount
        NUMERIC(20, 2)
        NOT NULL,

    budget_utilization_pct
        NUMERIC(7, 2)
        NOT NULL,

    funded_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    opportunity_cost_amount
        NUMERIC(20, 2)
        NOT NULL,

    average_priority_score
        NUMERIC(7, 2)
        NOT NULL,

    item_count
        INTEGER
        NOT NULL,

    funded_item_count
        INTEGER
        NOT NULL,

    deferred_item_count
        INTEGER
        NOT NULL,

    rejected_item_count
        INTEGER
        NOT NULL,

    pending_item_count
        INTEGER
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_capital_allocation_snapshot_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_capital_allocation_snapshot_cycle
        FOREIGN KEY (
            cycle_id
        )
        REFERENCES procurement_capital_allocation_cycles (id),

    CONSTRAINT fk_capital_allocation_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capital_allocation_snapshot_utilization
        CHECK (
            budget_utilization_pct
                BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_capital_allocation_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    allocation_item_id
        UUID
        NOT NULL,

    case_number
        VARCHAR(60)
        NOT NULL,

    initiative_number
        VARCHAR(60)
        NOT NULL,

    initiative_title
        VARCHAR(300)
        NOT NULL,

    requested_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    durable_horizon_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    payback_months
        NUMERIC(12, 2),

    persistence_pct
        NUMERIC(7, 2)
        NOT NULL,

    value_health
        VARCHAR(20)
        NOT NULL,

    priority_score
        NUMERIC(7, 2)
        NOT NULL,

    recommendation
        VARCHAR(20)
        NOT NULL,

    decision
        VARCHAR(20)
        NOT NULL,

    decision_note
        VARCHAR(5000),

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_capital_allocation_snapshot_item_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_capital_allocation_snapshots (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_capital_allocation_cycle_status
    ON procurement_capital_allocation_cycles (
        fiscal_year,
        currency,
        status
    );

CREATE INDEX idx_capital_allocation_item_cycle
    ON procurement_capital_allocation_items (
        cycle_id,
        decision,
        priority_score DESC
    );

CREATE INDEX idx_capital_allocation_snapshot_cycle
    ON procurement_capital_allocation_snapshots (
        cycle_id,
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_capital_allocation_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement capital allocation snapshots are immutable';
END;
$$;

CREATE TRIGGER trg_capital_allocation_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_capital_allocation_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capital_allocation_snapshot_mutation();

CREATE TRIGGER trg_capital_allocation_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_capital_allocation_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capital_allocation_snapshot_mutation();

CREATE TRIGGER trg_audit_capital_allocation_cycles
AFTER INSERT OR UPDATE
ON procurement_capital_allocation_cycles
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capital_allocation_items
AFTER INSERT OR UPDATE OR DELETE
ON procurement_capital_allocation_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capital_allocation_snapshots
AFTER INSERT
ON procurement_capital_allocation_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
