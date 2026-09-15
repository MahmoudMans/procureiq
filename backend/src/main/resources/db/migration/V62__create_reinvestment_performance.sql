CREATE SEQUENCE procurement_reinvestment_performance_case_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_reinvestment_performance_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_reinvestment_performance_cases (
    id UUID PRIMARY KEY,

    performance_case_number
        VARCHAR(60)
        NOT NULL,

    redeployment_case_id
        UUID
        NOT NULL,

    redeployment_number
        VARCHAR(60)
        NOT NULL,

    recycling_source_id
        UUID
        NOT NULL,

    recycling_source_number
        VARCHAR(60)
        NOT NULL,

    target_value_case_id
        UUID
        NOT NULL,

    target_value_case_number
        VARCHAR(60)
        NOT NULL,

    target_initiative_number
        VARCHAR(60)
        NOT NULL,

    target_initiative_title
        VARCHAR(300)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    redeployed_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_target_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    baseline_target_persistence_pct
        NUMERIC(7, 2)
        NOT NULL,

    baseline_target_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    measurement_horizon_months
        INTEGER
        NOT NULL,

    annual_operating_cost_amount
        NUMERIC(20, 2)
        NOT NULL,

    performance_owner_user_id
        UUID
        NOT NULL,

    performance_owner_name_snapshot
        VARCHAR(300)
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

    CONSTRAINT uk_reinvestment_performance_case_number
        UNIQUE (
            performance_case_number
        ),

    CONSTRAINT fk_reinvestment_performance_redeployment
        FOREIGN KEY (
            redeployment_case_id
        )
        REFERENCES procurement_capital_redeployment_cases (id),

    CONSTRAINT fk_reinvestment_performance_recycling_source
        FOREIGN KEY (
            recycling_source_id
        )
        REFERENCES procurement_capital_recycling_sources (id),

    CONSTRAINT fk_reinvestment_performance_target_value
        FOREIGN KEY (
            target_value_case_id
        )
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_reinvestment_performance_owner
        FOREIGN KEY (
            performance_owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_reinvestment_performance_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_reinvestment_performance_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_reinvestment_performance_amounts
        CHECK (
            redeployed_capital_amount > 0
            AND
            measurement_horizon_months > 0
            AND
            measurement_horizon_months <= 120
            AND
            annual_operating_cost_amount >= 0
        ),

    CONSTRAINT ck_reinvestment_performance_persistence
        CHECK (
            baseline_target_persistence_pct
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_reinvestment_performance_status
        CHECK (
            status IN (
                'ACTIVE',
                'READY_FOR_REVIEW',
                'REMEDIATION_REQUIRED',
                'VERIFIED',
                'CLOSED'
            )
        )
);

CREATE UNIQUE INDEX uk_reinvestment_performance_active_redeployment
    ON procurement_reinvestment_performance_cases (
        redeployment_case_id
    )
    WHERE status <> 'CLOSED';

CREATE TABLE procurement_reinvestment_performance_observations (
    id UUID PRIMARY KEY,

    performance_case_id
        UUID
        NOT NULL,

    observed_on
        DATE
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

    CONSTRAINT fk_reinvestment_performance_observation_case
        FOREIGN KEY (
            performance_case_id
        )
        REFERENCES procurement_reinvestment_performance_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reinvestment_performance_observation_reporter
        FOREIGN KEY (
            reported_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_reinvestment_performance_observation_value
        CHECK (
            reported_realized_annualized_value_amount >= 0
        )
);

CREATE TABLE procurement_reinvestment_performance_validations (
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

    CONSTRAINT uk_reinvestment_performance_validation_observation
        UNIQUE (
            observation_id
        ),

    CONSTRAINT fk_reinvestment_performance_validation_observation
        FOREIGN KEY (
            observation_id
        )
        REFERENCES procurement_reinvestment_performance_observations (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reinvestment_performance_validation_user
        FOREIGN KEY (
            validated_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_reinvestment_performance_validation_decision
        CHECK (
            decision IN (
                'VALIDATED',
                'REJECTED'
            )
        ),

    CONSTRAINT ck_reinvestment_performance_validation_shape
        CHECK (
            (
                decision = 'VALIDATED'
                AND
                validated_realized_annualized_value_amount IS NOT NULL
                AND
                validated_realized_annualized_value_amount >= 0
            )
            OR
            (
                decision = 'REJECTED'
                AND
                validated_realized_annualized_value_amount IS NULL
            )
        )
);

CREATE TABLE procurement_reinvestment_performance_reviews (
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

    redeployed_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    operating_cost_horizon_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_cost_amount
        NUMERIC(20, 2)
        NOT NULL,

    expected_horizon_value_amount
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

    baseline_target_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    realized_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    roi_variance_pct
        NUMERIC(12, 2)
        NOT NULL,

    value_variance_amount
        NUMERIC(20, 2)
        NOT NULL,

    realization_pct
        NUMERIC(7, 2)
        NOT NULL,

    review_note
        VARCHAR(5000)
        NOT NULL,

    reviewed_by_user_id
        UUID
        NOT NULL,

    reviewed_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_reinvestment_performance_review_case
        FOREIGN KEY (
            performance_case_id
        )
        REFERENCES procurement_reinvestment_performance_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reinvestment_performance_review_observation
        FOREIGN KEY (
            observation_id
        )
        REFERENCES procurement_reinvestment_performance_observations (id),

    CONSTRAINT fk_reinvestment_performance_review_user
        FOREIGN KEY (
            reviewed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_reinvestment_performance_review_decision
        CHECK (
            decision IN (
                'CONFIRMED',
                'REMEDIATION_REQUIRED'
            )
        ),

    CONSTRAINT ck_reinvestment_performance_review_health
        CHECK (
            health IN (
                'OUTPERFORMING',
                'ON_TRACK',
                'WATCH',
                'UNDERPERFORMING'
            )
        ),

    CONSTRAINT ck_reinvestment_performance_realization_pct
        CHECK (
            realization_pct
                BETWEEN 0 AND 999.99
        )
);

CREATE TABLE procurement_reinvestment_performance_snapshots (
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

    remediation_case_count
        INTEGER
        NOT NULL,

    average_realized_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    average_roi_variance_pct
        NUMERIC(12, 2)
        NOT NULL,

    average_realization_pct
        NUMERIC(7, 2)
        NOT NULL,

    total_redeployed_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_realized_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_reinvestment_performance_snapshot_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_reinvestment_performance_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id)
);

CREATE TABLE procurement_reinvestment_performance_snapshot_items (
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

    redeployment_number
        VARCHAR(60)
        NOT NULL,

    target_value_case_number
        VARCHAR(60)
        NOT NULL,

    target_initiative_title
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

    redeployed_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    expected_horizon_value_amount
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

    baseline_target_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    realized_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    roi_variance_pct
        NUMERIC(12, 2)
        NOT NULL,

    value_variance_amount
        NUMERIC(20, 2)
        NOT NULL,

    realization_pct
        NUMERIC(7, 2)
        NOT NULL,

    health
        VARCHAR(30)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_reinvestment_performance_snapshot_item_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_reinvestment_performance_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_reinvestment_performance_snapshot_item_health
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

CREATE INDEX idx_reinvestment_performance_case_status
    ON procurement_reinvestment_performance_cases (
        status,
        fiscal_year,
        currency
    );

CREATE INDEX idx_reinvestment_performance_observation_case
    ON procurement_reinvestment_performance_observations (
        performance_case_id,
        observed_on DESC,
        reported_at DESC
    );

CREATE INDEX idx_reinvestment_performance_review_case
    ON procurement_reinvestment_performance_reviews (
        performance_case_id,
        reviewed_at DESC
    );

CREATE INDEX idx_reinvestment_performance_snapshot_capture
    ON procurement_reinvestment_performance_snapshots (
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_reinvestment_performance_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement reinvestment performance evidence is immutable';
END;
$$;

CREATE TRIGGER trg_reinvestment_performance_observation_immutable
BEFORE UPDATE OR DELETE
ON procurement_reinvestment_performance_observations
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_reinvestment_performance_evidence_mutation();

CREATE TRIGGER trg_reinvestment_performance_validation_immutable
BEFORE UPDATE OR DELETE
ON procurement_reinvestment_performance_validations
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_reinvestment_performance_evidence_mutation();

CREATE TRIGGER trg_reinvestment_performance_review_immutable
BEFORE UPDATE OR DELETE
ON procurement_reinvestment_performance_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_reinvestment_performance_evidence_mutation();

CREATE TRIGGER trg_reinvestment_performance_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_reinvestment_performance_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_reinvestment_performance_evidence_mutation();

CREATE TRIGGER trg_reinvestment_performance_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_reinvestment_performance_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_reinvestment_performance_evidence_mutation();

CREATE TRIGGER trg_audit_reinvestment_performance_cases
AFTER INSERT OR UPDATE
ON procurement_reinvestment_performance_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_reinvestment_performance_observations
AFTER INSERT
ON procurement_reinvestment_performance_observations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_reinvestment_performance_validations
AFTER INSERT
ON procurement_reinvestment_performance_validations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_reinvestment_performance_reviews
AFTER INSERT
ON procurement_reinvestment_performance_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_reinvestment_performance_snapshots
AFTER INSERT
ON procurement_reinvestment_performance_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
