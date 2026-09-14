CREATE SEQUENCE procurement_governance_review_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_governance_decision_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_governance_action_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_governance_reviews (
    id UUID PRIMARY KEY,

    review_number
        VARCHAR(50)
        NOT NULL,

    title
        VARCHAR(240)
        NOT NULL,

    period_start
        DATE
        NOT NULL,

    period_end
        DATE
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

    chair_user_id
        UUID
        NOT NULL,

    executive_summary
        VARCHAR(5000)
        NOT NULL,

    frozen_at
        TIMESTAMPTZ,

    opened_at
        TIMESTAMPTZ,

    closed_at
        TIMESTAMPTZ,

    archived_at
        TIMESTAMPTZ,

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

    CONSTRAINT uk_governance_review_number
        UNIQUE (
            review_number
        ),

    CONSTRAINT fk_governance_review_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_governance_review_chair
        FOREIGN KEY (
            chair_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_governance_review_dates
        CHECK (
            period_end >= period_start
        ),

    CONSTRAINT ck_governance_review_status
        CHECK (
            status IN (
                'DRAFT',
                'FROZEN',
                'IN_REVIEW',
                'CLOSED',
                'ARCHIVED'
            )
        )
);

CREATE TABLE procurement_governance_review_snapshots (
    review_id UUID PRIMARY KEY,

    evaluated_suppliers
        BIGINT
        NOT NULL,

    high_risk_suppliers
        BIGINT
        NOT NULL,

    critical_risk_suppliers
        BIGINT
        NOT NULL,

    spend_at_high_risk
        NUMERIC(19, 2)
        NOT NULL,

    active_risk_alerts
        BIGINT
        NOT NULL,

    open_risk_escalations
        BIGINT
        NOT NULL,

    active_category_strategies
        BIGINT
        NOT NULL,

    active_category_initiatives
        BIGINT
        NOT NULL,

    overdue_category_initiatives
        BIGINT
        NOT NULL,

    approved_scenarios
        BIGINT
        NOT NULL,

    active_execution_portfolios
        BIGINT
        NOT NULL,

    baseline_target_savings
        NUMERIC(19, 2)
        NOT NULL,

    forecast_savings
        NUMERIC(19, 2)
        NOT NULL,

    operational_reported_savings
        NUMERIC(19, 2)
        NOT NULL,

    validated_savings
        NUMERIC(19, 2)
        NOT NULL,

    validation_pending_items
        BIGINT
        NOT NULL,

    active_leakage_cases
        BIGINT
        NOT NULL,

    active_leakage_amount
        NUMERIC(19, 2)
        NOT NULL,

    at_risk_amount
        NUMERIC(19, 2)
        NOT NULL,

    active_assumptions
        BIGINT
        NOT NULL,

    invalidated_assumptions
        BIGINT
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_governance_snapshot_review
        FOREIGN KEY (
            review_id
        )
        REFERENCES procurement_governance_reviews (id)
        ON DELETE CASCADE
);

CREATE TABLE procurement_governance_snapshot_items (
    id UUID PRIMARY KEY,

    review_id
        UUID
        NOT NULL,

    item_type
        VARCHAR(30)
        NOT NULL,

    item_key
        VARCHAR(160)
        NOT NULL,

    rank_position
        INTEGER
        NOT NULL,

    severity
        VARCHAR(20)
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    subtitle
        VARCHAR(500),

    metric_label
        VARCHAR(120)
        NOT NULL,

    metric_value
        NUMERIC(19, 2)
        NOT NULL,

    currency
        VARCHAR(3),

    details
        VARCHAR(2500)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_governance_snapshot_item_review
        FOREIGN KEY (
            review_id
        )
        REFERENCES procurement_governance_reviews (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_governance_snapshot_item
        UNIQUE (
            review_id,
            item_type,
            item_key
        ),

    CONSTRAINT ck_governance_snapshot_item_type
        CHECK (
            item_type IN (
                'SUPPLIER_RISK',
                'CATEGORY_STRATEGY',
                'BENEFIT_PORTFOLIO'
            )
        ),

    CONSTRAINT ck_governance_snapshot_item_severity
        CHECK (
            severity IN (
                'INFO',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        )
);

CREATE TABLE procurement_governance_decisions (
    id UUID PRIMARY KEY,

    decision_number
        VARCHAR(50)
        NOT NULL,

    review_id
        UUID
        NOT NULL,

    decision_type
        VARCHAR(30)
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    description
        VARCHAR(3000)
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    requested_by_user_id
        UUID
        NOT NULL,

    decision_owner_user_id
        UUID
        NOT NULL,

    due_date
        DATE,

    decision_note
        VARCHAR(3000),

    decided_by_user_id
        UUID,

    decided_at
        TIMESTAMPTZ,

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

    CONSTRAINT uk_governance_decision_number
        UNIQUE (
            decision_number
        ),

    CONSTRAINT fk_governance_decision_review
        FOREIGN KEY (
            review_id
        )
        REFERENCES procurement_governance_reviews (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_governance_decision_requester
        FOREIGN KEY (
            requested_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_governance_decision_owner
        FOREIGN KEY (
            decision_owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_governance_decision_decider
        FOREIGN KEY (
            decided_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_governance_decision_type
        CHECK (
            decision_type IN (
                'APPROVAL',
                'ESCALATION',
                'PRIORITY',
                'RISK_ACCEPTANCE',
                'INVESTMENT',
                'OTHER'
            )
        ),

    CONSTRAINT ck_governance_decision_status
        CHECK (
            status IN (
                'OPEN',
                'APPROVED',
                'REJECTED',
                'DEFERRED'
            )
        )
);

CREATE TABLE procurement_governance_actions (
    id UUID PRIMARY KEY,

    action_number
        VARCHAR(50)
        NOT NULL,

    review_id
        UUID
        NOT NULL,

    decision_id
        UUID,

    title
        VARCHAR(300)
        NOT NULL,

    description
        VARCHAR(2500),

    owner_user_id
        UUID
        NOT NULL,

    priority
        VARCHAR(20)
        NOT NULL,

    due_date
        DATE
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    completion_note
        VARCHAR(2500),

    completed_at
        TIMESTAMPTZ,

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

    CONSTRAINT uk_governance_action_number
        UNIQUE (
            action_number
        ),

    CONSTRAINT fk_governance_action_review
        FOREIGN KEY (
            review_id
        )
        REFERENCES procurement_governance_reviews (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_governance_action_decision
        FOREIGN KEY (
            decision_id
        )
        REFERENCES procurement_governance_decisions (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_governance_action_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_governance_action_priority
        CHECK (
            priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_governance_action_status
        CHECK (
            status IN (
                'OPEN',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        )
);

CREATE INDEX idx_governance_review_status
    ON procurement_governance_reviews (
        currency,
        status,
        period_end DESC
    );

CREATE INDEX idx_governance_snapshot_item_review
    ON procurement_governance_snapshot_items (
        review_id,
        item_type,
        rank_position
    );

CREATE INDEX idx_governance_decision_review
    ON procurement_governance_decisions (
        review_id,
        status,
        due_date
    );

CREATE INDEX idx_governance_action_review
    ON procurement_governance_actions (
        review_id,
        status,
        due_date
    );

CREATE TRIGGER trg_audit_procurement_governance_reviews
AFTER INSERT OR UPDATE OR DELETE
ON procurement_governance_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_governance_decisions
AFTER INSERT OR UPDATE OR DELETE
ON procurement_governance_decisions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_governance_actions
AFTER INSERT OR UPDATE OR DELETE
ON procurement_governance_actions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
