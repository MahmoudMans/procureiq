CREATE SEQUENCE procurement_reinvestment_persistence_case_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_reinvestment_persistence_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_reinvestment_persistence_cases (
    id UUID PRIMARY KEY,

    persistence_case_number
        VARCHAR(60)
        NOT NULL,

    source_performance_case_id
        UUID
        NOT NULL,

    source_performance_case_number
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

    baseline_validated_annualized_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_realized_horizon_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_realized_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_total_cost_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_realized_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    baseline_realization_pct
        NUMERIC(7, 2)
        NOT NULL,

    baseline_performance_health
        VARCHAR(30)
        NOT NULL,

    measurement_horizon_months
        INTEGER
        NOT NULL,

    persistence_observation_window_months
        INTEGER
        NOT NULL,

    minimum_value_persistence_pct
        NUMERIC(7, 2)
        NOT NULL,

    minimum_efficiency_retention_pct
        NUMERIC(7, 2)
        NOT NULL,

    persistence_owner_user_id
        UUID
        NOT NULL,

    persistence_owner_name_snapshot
        VARCHAR(300)
        NOT NULL,

    persistence_objective
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

    CONSTRAINT uk_reinvestment_persistence_case_number
        UNIQUE (
            persistence_case_number
        ),

    CONSTRAINT fk_reinvestment_persistence_source_performance
        FOREIGN KEY (
            source_performance_case_id
        )
        REFERENCES procurement_reinvestment_performance_cases (id),

    CONSTRAINT fk_reinvestment_persistence_redeployment
        FOREIGN KEY (
            redeployment_case_id
        )
        REFERENCES procurement_capital_redeployment_cases (id),

    CONSTRAINT fk_reinvestment_persistence_recycling
        FOREIGN KEY (
            recycling_source_id
        )
        REFERENCES procurement_capital_recycling_sources (id),

    CONSTRAINT fk_reinvestment_persistence_target
        FOREIGN KEY (
            target_value_case_id
        )
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_reinvestment_persistence_owner
        FOREIGN KEY (
            persistence_owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_reinvestment_persistence_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_reinvestment_persistence_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_reinvestment_persistence_baseline
        CHECK (
            redeployed_capital_amount > 0
            AND baseline_validated_annualized_value_amount > 0
            AND baseline_realized_horizon_value_amount > 0
            AND baseline_total_cost_amount > 0
            AND measurement_horizon_months > 0
            AND measurement_horizon_months <= 120
        ),

    CONSTRAINT ck_reinvestment_persistence_window
        CHECK (
            persistence_observation_window_months
                BETWEEN 0 AND 36
        ),

    CONSTRAINT ck_reinvestment_persistence_thresholds
        CHECK (
            minimum_value_persistence_pct
                BETWEEN 50 AND 100
            AND minimum_efficiency_retention_pct
                BETWEEN 50 AND 100
        ),

    CONSTRAINT ck_reinvestment_persistence_baseline_realization
        CHECK (
            baseline_realization_pct
                BETWEEN 0 AND 999.99
        ),

    CONSTRAINT ck_reinvestment_persistence_health
        CHECK (
            baseline_performance_health IN (
                'OUTPERFORMING',
                'ON_TRACK',
                'WATCH',
                'UNDERPERFORMING'
            )
        ),

    CONSTRAINT ck_reinvestment_persistence_status
        CHECK (
            status IN (
                'ACTIVE',
                'READY_FOR_REVIEW',
                'REMEDIATION_REQUIRED',
                'SUSTAINED',
                'CLOSED'
            )
        )
);

CREATE UNIQUE INDEX uk_reinvestment_persistence_active_performance
    ON procurement_reinvestment_persistence_cases (
        source_performance_case_id
    )
    WHERE status <> 'CLOSED';

CREATE TABLE procurement_reinvestment_persistence_observations (
    id UUID PRIMARY KEY,

    persistence_case_id
        UUID
        NOT NULL,

    observed_on
        DATE
        NOT NULL,

    reported_current_annualized_value_amount
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

    CONSTRAINT fk_reinvestment_persistence_observation_case
        FOREIGN KEY (
            persistence_case_id
        )
        REFERENCES procurement_reinvestment_persistence_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reinvestment_persistence_observation_reporter
        FOREIGN KEY (
            reported_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_reinvestment_persistence_observation_value
        CHECK (
            reported_current_annualized_value_amount >= 0
        )
);

CREATE TABLE procurement_reinvestment_persistence_validations (
    id UUID PRIMARY KEY,

    observation_id
        UUID
        NOT NULL,

    decision
        VARCHAR(20)
        NOT NULL,

    validated_current_annualized_value_amount
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

    CONSTRAINT uk_reinvestment_persistence_validation_observation
        UNIQUE (
            observation_id
        ),

    CONSTRAINT fk_reinvestment_persistence_validation_observation
        FOREIGN KEY (
            observation_id
        )
        REFERENCES procurement_reinvestment_persistence_observations (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reinvestment_persistence_validation_user
        FOREIGN KEY (
            validated_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_reinvestment_persistence_validation_decision
        CHECK (
            decision IN (
                'VALIDATED',
                'REJECTED'
            )
        ),

    CONSTRAINT ck_reinvestment_persistence_validation_shape
        CHECK (
            (
                decision = 'VALIDATED'
                AND
                validated_current_annualized_value_amount IS NOT NULL
                AND
                validated_current_annualized_value_amount >= 0
            )
            OR
            (
                decision = 'REJECTED'
                AND
                validated_current_annualized_value_amount IS NULL
            )
        )
);

CREATE TABLE procurement_reinvestment_persistence_reviews (
    id UUID PRIMARY KEY,

    persistence_case_id
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

    baseline_validated_annualized_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    current_validated_annualized_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_realized_horizon_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    current_projected_horizon_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_realized_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    current_projected_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_realized_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    current_projected_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    roi_variance_pct
        NUMERIC(12, 2)
        NOT NULL,

    value_persistence_pct
        NUMERIC(7, 2)
        NOT NULL,

    compounding_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    decayed_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_capital_efficiency_multiple
        NUMERIC(14, 4)
        NOT NULL,

    current_capital_efficiency_multiple
        NUMERIC(14, 4)
        NOT NULL,

    capital_efficiency_delta
        NUMERIC(14, 4)
        NOT NULL,

    efficiency_retention_pct
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

    CONSTRAINT fk_reinvestment_persistence_review_case
        FOREIGN KEY (
            persistence_case_id
        )
        REFERENCES procurement_reinvestment_persistence_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reinvestment_persistence_review_observation
        FOREIGN KEY (
            observation_id
        )
        REFERENCES procurement_reinvestment_persistence_observations (id),

    CONSTRAINT fk_reinvestment_persistence_review_user
        FOREIGN KEY (
            reviewed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_reinvestment_persistence_review_decision
        CHECK (
            decision IN (
                'SUSTAINED',
                'REMEDIATION_REQUIRED'
            )
        ),

    CONSTRAINT ck_reinvestment_persistence_review_health
        CHECK (
            health IN (
                'COMPOUNDING',
                'SUSTAINED',
                'WATCH',
                'DECAYING',
                'REGRESSED'
            )
        ),

    CONSTRAINT ck_reinvestment_persistence_review_pct
        CHECK (
            value_persistence_pct
                BETWEEN 0 AND 999.99
            AND
            efficiency_retention_pct
                BETWEEN 0 AND 999.99
        )
);

CREATE TABLE procurement_reinvestment_persistence_snapshots (
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

    compounding_case_count
        INTEGER
        NOT NULL,

    sustained_case_count
        INTEGER
        NOT NULL,

    watch_case_count
        INTEGER
        NOT NULL,

    decaying_case_count
        INTEGER
        NOT NULL,

    regressed_case_count
        INTEGER
        NOT NULL,

    remediation_case_count
        INTEGER
        NOT NULL,

    average_value_persistence_pct
        NUMERIC(7, 2)
        NOT NULL,

    average_efficiency_retention_pct
        NUMERIC(7, 2)
        NOT NULL,

    average_projected_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    total_baseline_realized_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_current_projected_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_compounding_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_decayed_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_reinvestment_persistence_snapshot_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_reinvestment_persistence_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id)
);

CREATE TABLE procurement_reinvestment_persistence_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    persistence_case_id
        UUID
        NOT NULL,

    persistence_case_number
        VARCHAR(60)
        NOT NULL,

    source_performance_case_number
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

    baseline_annualized_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    current_annualized_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_horizon_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    current_projected_horizon_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    current_projected_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    current_projected_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    roi_variance_pct
        NUMERIC(12, 2)
        NOT NULL,

    value_persistence_pct
        NUMERIC(7, 2)
        NOT NULL,

    efficiency_retention_pct
        NUMERIC(7, 2)
        NOT NULL,

    compounding_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    decayed_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    health
        VARCHAR(30)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_reinvestment_persistence_snapshot_item_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_reinvestment_persistence_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_reinvestment_persistence_snapshot_health
        CHECK (
            health IN (
                'UNASSESSED',
                'COMPOUNDING',
                'SUSTAINED',
                'WATCH',
                'DECAYING',
                'REGRESSED'
            )
        )
);

CREATE INDEX idx_reinvestment_persistence_case_status
    ON procurement_reinvestment_persistence_cases (
        status,
        fiscal_year,
        currency
    );

CREATE INDEX idx_reinvestment_persistence_observation_case
    ON procurement_reinvestment_persistence_observations (
        persistence_case_id,
        observed_on DESC,
        reported_at DESC
    );

CREATE INDEX idx_reinvestment_persistence_review_case
    ON procurement_reinvestment_persistence_reviews (
        persistence_case_id,
        reviewed_at DESC
    );

CREATE INDEX idx_reinvestment_persistence_snapshot_capture
    ON procurement_reinvestment_persistence_snapshots (
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_reinvestment_persistence_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement reinvestment persistence evidence is immutable';
END;
$$;

CREATE TRIGGER trg_reinvestment_persistence_observation_immutable
BEFORE UPDATE OR DELETE
ON procurement_reinvestment_persistence_observations
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_reinvestment_persistence_evidence_mutation();

CREATE TRIGGER trg_reinvestment_persistence_validation_immutable
BEFORE UPDATE OR DELETE
ON procurement_reinvestment_persistence_validations
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_reinvestment_persistence_evidence_mutation();

CREATE TRIGGER trg_reinvestment_persistence_review_immutable
BEFORE UPDATE OR DELETE
ON procurement_reinvestment_persistence_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_reinvestment_persistence_evidence_mutation();

CREATE TRIGGER trg_reinvestment_persistence_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_reinvestment_persistence_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_reinvestment_persistence_evidence_mutation();

CREATE TRIGGER trg_reinvestment_persistence_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_reinvestment_persistence_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_reinvestment_persistence_evidence_mutation();

CREATE TRIGGER trg_audit_reinvestment_persistence_cases
AFTER INSERT OR UPDATE
ON procurement_reinvestment_persistence_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_reinvestment_persistence_observations
AFTER INSERT
ON procurement_reinvestment_persistence_observations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_reinvestment_persistence_validations
AFTER INSERT
ON procurement_reinvestment_persistence_validations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_reinvestment_persistence_reviews
AFTER INSERT
ON procurement_reinvestment_persistence_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_reinvestment_persistence_snapshots
AFTER INSERT
ON procurement_reinvestment_persistence_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
