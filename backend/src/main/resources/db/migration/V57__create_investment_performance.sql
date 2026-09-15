CREATE SEQUENCE procurement_investment_performance_case_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_investment_performance_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_investment_performance_cases (
    id UUID PRIMARY KEY,

    performance_case_number
        VARCHAR(60)
        NOT NULL,

    funding_commitment_id
        UUID
        NOT NULL,

    funding_commitment_number
        VARCHAR(60)
        NOT NULL,

    allocation_cycle_number
        VARCHAR(60)
        NOT NULL,

    value_case_id
        UUID
        NOT NULL,

    value_case_number
        VARCHAR(60)
        NOT NULL,

    initiative_number
        VARCHAR(60)
        NOT NULL,

    initiative_title
        VARCHAR(300)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    performance_owner_user_id
        UUID
        NOT NULL,

    performance_owner_name_snapshot
        VARCHAR(300)
        NOT NULL,

    baseline_investment_cost_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_annual_operating_cost_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_annualized_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_durable_annual_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_durable_horizon_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    baseline_target_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    baseline_target_payback_months
        NUMERIC(12, 2)
        NOT NULL,

    value_horizon_months
        INTEGER
        NOT NULL,

    performance_objective
        VARCHAR(5000)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

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

    CONSTRAINT uk_investment_performance_case_number
        UNIQUE (
            performance_case_number
        ),

    CONSTRAINT fk_investment_performance_funding_commitment
        FOREIGN KEY (
            funding_commitment_id
        )
        REFERENCES procurement_funding_commitments (id),

    CONSTRAINT fk_investment_performance_value_case
        FOREIGN KEY (
            value_case_id
        )
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_investment_performance_owner
        FOREIGN KEY (
            performance_owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_investment_performance_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_investment_performance_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_investment_performance_baselines
        CHECK (
            baseline_investment_cost_amount > 0
            AND
            baseline_annual_operating_cost_amount >= 0
            AND
            baseline_annualized_value_amount >= 0
            AND
            baseline_durable_annual_value_amount >= 0
            AND
            baseline_durable_horizon_value_amount >= 0
            AND
            value_horizon_months > 0
        ),

    CONSTRAINT ck_investment_performance_status
        CHECK (
            status IN (
                'ACTIVE',
                'READY_FOR_REVIEW',
                'IN_REMEDIATION',
                'VERIFIED',
                'CLOSED'
            )
        )
);

CREATE UNIQUE INDEX uk_investment_performance_active_funding_commitment
    ON procurement_investment_performance_cases (
        funding_commitment_id
    )
    WHERE status <> 'CLOSED';

CREATE TABLE procurement_investment_performance_observations (
    id UUID PRIMARY KEY,

    performance_case_id
        UUID
        NOT NULL,

    observed_on
        DATE
        NOT NULL,

    released_capital_snapshot
        NUMERIC(20, 2)
        NOT NULL,

    release_pct_snapshot
        NUMERIC(7, 2)
        NOT NULL,

    reported_realized_annualized_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    evidence_note
        VARCHAR(5000)
        NOT NULL,

    reported_by_user_id
        UUID
        NOT NULL,

    reported_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_investment_performance_observation_case
        FOREIGN KEY (
            performance_case_id
        )
        REFERENCES procurement_investment_performance_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_investment_performance_observation_reporter
        FOREIGN KEY (
            reported_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_investment_performance_observation_capital
        CHECK (
            released_capital_snapshot > 0
        ),

    CONSTRAINT ck_investment_performance_observation_release_pct
        CHECK (
            release_pct_snapshot
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_investment_performance_observation_value
        CHECK (
            reported_realized_annualized_value_amount >= 0
        )
);

CREATE TABLE procurement_investment_performance_validations (
    id UUID PRIMARY KEY,

    observation_id
        UUID
        NOT NULL,

    decision
        VARCHAR(20)
        NOT NULL,

    validated_realized_annualized_value_amount
        NUMERIC(20, 2),

    validation_note
        VARCHAR(5000)
        NOT NULL,

    validated_by_user_id
        UUID
        NOT NULL,

    validated_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_investment_performance_validation_observation
        UNIQUE (
            observation_id
        ),

    CONSTRAINT fk_investment_performance_validation_observation
        FOREIGN KEY (
            observation_id
        )
        REFERENCES procurement_investment_performance_observations (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_investment_performance_validation_user
        FOREIGN KEY (
            validated_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_investment_performance_validation_decision
        CHECK (
            decision IN (
                'VALIDATED',
                'REJECTED'
            )
        ),

    CONSTRAINT ck_investment_performance_validation_value
        CHECK (
            (
                decision = 'VALIDATED'
                AND
                validated_realized_annualized_value_amount
                    IS NOT NULL
                AND
                validated_realized_annualized_value_amount
                    >= 0
            )
            OR
            (
                decision = 'REJECTED'
                AND
                validated_realized_annualized_value_amount
                    IS NULL
            )
        )
);

CREATE TABLE procurement_investment_performance_decisions (
    id UUID PRIMARY KEY,

    performance_case_id
        UUID
        NOT NULL,

    observation_id
        UUID
        NOT NULL,

    decision
        VARCHAR(30)
        NOT NULL,

    health
        VARCHAR(30)
        NOT NULL,

    released_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    validated_realized_annualized_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    realized_horizon_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    realized_total_cost_amount
        NUMERIC(20, 2)
        NOT NULL,

    realized_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    realized_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    baseline_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    roi_variance_pct
        NUMERIC(12, 2)
        NOT NULL,

    funding_variance_amount
        NUMERIC(20, 2)
        NOT NULL,

    funding_variance_pct
        NUMERIC(12, 2)
        NOT NULL,

    capital_efficiency_multiple
        NUMERIC(12, 4)
        NOT NULL,

    value_variance_amount
        NUMERIC(20, 2)
        NOT NULL,

    decision_note
        VARCHAR(5000)
        NOT NULL,

    decided_by_user_id
        UUID
        NOT NULL,

    decided_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_investment_performance_decision_case
        FOREIGN KEY (
            performance_case_id
        )
        REFERENCES procurement_investment_performance_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_investment_performance_decision_observation
        FOREIGN KEY (
            observation_id
        )
        REFERENCES procurement_investment_performance_observations (id),

    CONSTRAINT fk_investment_performance_decision_user
        FOREIGN KEY (
            decided_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_investment_performance_decision_type
        CHECK (
            decision IN (
                'CONFIRMED',
                'REMEDIATION_REQUIRED'
            )
        ),

    CONSTRAINT ck_investment_performance_decision_health
        CHECK (
            health IN (
                'OUTPERFORMING',
                'ON_TRACK',
                'WATCH',
                'UNDERPERFORMING'
            )
        )
);

CREATE TABLE procurement_investment_performance_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number
        VARCHAR(60)
        NOT NULL,

    case_count
        INTEGER
        NOT NULL,

    assessed_case_count
        INTEGER
        NOT NULL,

    outperforming_case_count
        INTEGER
        NOT NULL,

    on_track_case_count
        INTEGER
        NOT NULL,

    watch_case_count
        INTEGER
        NOT NULL,

    underperforming_case_count
        INTEGER
        NOT NULL,

    average_realized_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    average_roi_variance_pct
        NUMERIC(12, 2)
        NOT NULL,

    average_funding_variance_pct
        NUMERIC(12, 2)
        NOT NULL,

    average_capital_efficiency_multiple
        NUMERIC(12, 4)
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_investment_performance_snapshot_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_investment_performance_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id)
);

CREATE TABLE procurement_investment_performance_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    performance_case_id
        UUID
        NOT NULL,

    performance_case_number
        VARCHAR(60)
        NOT NULL,

    funding_commitment_number
        VARCHAR(60)
        NOT NULL,

    value_case_number
        VARCHAR(60)
        NOT NULL,

    initiative_number
        VARCHAR(60)
        NOT NULL,

    initiative_title
        VARCHAR(300)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    case_status
        VARCHAR(30)
        NOT NULL,

    assessed
        BOOLEAN
        NOT NULL,

    released_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_investment_cost_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_durable_horizon_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    validated_realized_annualized_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    realized_horizon_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    realized_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    realized_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    roi_variance_pct
        NUMERIC(12, 2)
        NOT NULL,

    funding_variance_amount
        NUMERIC(20, 2)
        NOT NULL,

    funding_variance_pct
        NUMERIC(12, 2)
        NOT NULL,

    capital_efficiency_multiple
        NUMERIC(12, 4)
        NOT NULL,

    value_variance_amount
        NUMERIC(20, 2)
        NOT NULL,

    health
        VARCHAR(30)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_investment_performance_snapshot_item_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_investment_performance_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_investment_performance_snapshot_item_health
        CHECK (
            health IN (
                'UNASSESSED',
                'OUTPERFORMING',
                'ON_TRACK',
                'WATCH',
                'UNDERPERFORMING'
            )
        )
);

CREATE INDEX idx_investment_performance_case_status
    ON procurement_investment_performance_cases (
        status,
        fiscal_year,
        currency
    );

CREATE INDEX idx_investment_performance_observation_case
    ON procurement_investment_performance_observations (
        performance_case_id,
        observed_on DESC,
        reported_at DESC
    );

CREATE INDEX idx_investment_performance_decision_case
    ON procurement_investment_performance_decisions (
        performance_case_id,
        decided_at DESC
    );

CREATE INDEX idx_investment_performance_snapshot_capture
    ON procurement_investment_performance_snapshots (
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_investment_performance_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement investment performance evidence is immutable';
END;
$$;

CREATE TRIGGER trg_investment_performance_observation_immutable
BEFORE UPDATE OR DELETE
ON procurement_investment_performance_observations
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_investment_performance_evidence_mutation();

CREATE TRIGGER trg_investment_performance_validation_immutable
BEFORE UPDATE OR DELETE
ON procurement_investment_performance_validations
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_investment_performance_evidence_mutation();

CREATE TRIGGER trg_investment_performance_decision_immutable
BEFORE UPDATE OR DELETE
ON procurement_investment_performance_decisions
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_investment_performance_evidence_mutation();

CREATE TRIGGER trg_investment_performance_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_investment_performance_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_investment_performance_evidence_mutation();

CREATE TRIGGER trg_investment_performance_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_investment_performance_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_investment_performance_evidence_mutation();

CREATE TRIGGER trg_audit_investment_performance_cases
AFTER INSERT OR UPDATE
ON procurement_investment_performance_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_investment_performance_observations
AFTER INSERT
ON procurement_investment_performance_observations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_investment_performance_validations
AFTER INSERT
ON procurement_investment_performance_validations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_investment_performance_decisions
AFTER INSERT
ON procurement_investment_performance_decisions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_investment_performance_snapshots
AFTER INSERT
ON procurement_investment_performance_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
