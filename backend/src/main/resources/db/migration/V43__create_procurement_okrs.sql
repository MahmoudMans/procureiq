CREATE SEQUENCE procurement_strategic_objective_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_okr_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_strategic_objectives (
    id UUID PRIMARY KEY,

    objective_number
        VARCHAR(50)
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    description
        VARCHAR(5000)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    period_type
        VARCHAR(20)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    quarter
        INTEGER,

    start_date
        DATE
        NOT NULL,

    end_date
        DATE
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    owner_user_id
        UUID
        NOT NULL,

    started_at
        TIMESTAMPTZ,

    achieved_at
        TIMESTAMPTZ,

    closed_at
        TIMESTAMPTZ,

    cancelled_at
        TIMESTAMPTZ,

    cancellation_note
        VARCHAR(3000),

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

    CONSTRAINT uk_strategic_objective_number
        UNIQUE (
            objective_number
        ),

    CONSTRAINT fk_strategic_objective_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategic_objective_period
        CHECK (
            period_type IN (
                'ANNUAL',
                'QUARTERLY'
            )
        ),

    CONSTRAINT ck_strategic_objective_quarter
        CHECK (
            (
                period_type =
                    'ANNUAL'
                AND quarter IS NULL
            )
            OR
            (
                period_type =
                    'QUARTERLY'
                AND quarter BETWEEN 1 AND 4
            )
        ),

    CONSTRAINT ck_strategic_objective_dates
        CHECK (
            end_date >= start_date
        ),

    CONSTRAINT ck_strategic_objective_status
        CHECK (
            status IN (
                'DRAFT',
                'ACTIVE',
                'ON_HOLD',
                'ACHIEVED',
                'CLOSED',
                'CANCELLED'
            )
        )
);

CREATE TABLE procurement_key_results (
    id UUID PRIMARY KEY,

    objective_id
        UUID
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    description
        VARCHAR(3000),

    metric_type
        VARCHAR(20)
        NOT NULL,

    direction
        VARCHAR(20)
        NOT NULL,

    source_type
        VARCHAR(60)
        NOT NULL,

    source_scope_type
        VARCHAR(30),

    source_scope_key
        VARCHAR(160),

    baseline_value
        NUMERIC(24, 4)
        NOT NULL,

    target_value
        NUMERIC(24, 4)
        NOT NULL,

    actual_value
        NUMERIC(24, 4)
        NOT NULL,

    weight_pct
        NUMERIC(7, 2)
        NOT NULL,

    source_observed_at
        TIMESTAMPTZ,

    actual_updated_at
        TIMESTAMPTZ,

    manual_note
        VARCHAR(3000),

    status
        VARCHAR(20)
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

    CONSTRAINT fk_key_result_objective
        FOREIGN KEY (
            objective_id
        )
        REFERENCES procurement_strategic_objectives (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_key_result_metric_type
        CHECK (
            metric_type IN (
                'PERCENTAGE',
                'COUNT',
                'CURRENCY',
                'HOURS',
                'NUMBER'
            )
        ),

    CONSTRAINT ck_key_result_direction
        CHECK (
            direction IN (
                'INCREASE',
                'DECREASE'
            )
        ),

    CONSTRAINT ck_key_result_source_type
        CHECK (
            source_type IN (
                'MANUAL',
                'OPERATING_RHYTHM_SLA_ATTAINMENT',
                'OPERATING_RHYTHM_ACTIVE_BACKLOG',
                'OPERATING_RHYTHM_SLA_OVERDUE',
                'OPERATING_RHYTHM_PERSISTENT_BACKLOG',
                'OPERATING_RHYTHM_AVG_RESOLUTION_HOURS',
                'OPERATING_RHYTHM_ACTIVE_EXPOSURE',
                'CONTINUOUS_IMPROVEMENT_ACTIVE_INITIATIVES',
                'CONTINUOUS_IMPROVEMENT_COMPLETED_INITIATIVES',
                'CONTINUOUS_IMPROVEMENT_IMPROVED_INITIATIVES',
                'CONTINUOUS_IMPROVEMENT_COMPLETION_RATE'
            )
        ),

    CONSTRAINT ck_key_result_scope_type
        CHECK (
            source_scope_type IS NULL
            OR source_scope_type IN (
                'OVERALL',
                'DOMAIN',
                'OWNER',
                'SEVERITY',
                'EXCEPTION_TYPE'
            )
        ),

    CONSTRAINT ck_key_result_weight
        CHECK (
            weight_pct > 0
            AND weight_pct <= 100
        ),

    CONSTRAINT ck_key_result_status
        CHECK (
            status IN (
                'ACTIVE',
                'ACHIEVED'
            )
        )
);

CREATE TABLE procurement_okr_contributions (
    id UUID PRIMARY KEY,

    key_result_id
        UUID
        NOT NULL,

    improvement_initiative_id
        UUID
        NOT NULL,

    contribution_weight_pct
        NUMERIC(7, 2)
        NOT NULL,

    rationale
        VARCHAR(2500)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_okr_contribution_key_result
        FOREIGN KEY (
            key_result_id
        )
        REFERENCES procurement_key_results (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_okr_contribution_improvement
        FOREIGN KEY (
            improvement_initiative_id
        )
        REFERENCES procurement_improvement_initiatives (id),

    CONSTRAINT uk_okr_contribution
        UNIQUE (
            key_result_id,
            improvement_initiative_id
        ),

    CONSTRAINT ck_okr_contribution_weight
        CHECK (
            contribution_weight_pct > 0
            AND contribution_weight_pct <= 100
        )
);

CREATE TABLE procurement_okr_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number
        VARCHAR(50)
        NOT NULL,

    objective_id
        UUID
        NOT NULL,

    objective_number
        VARCHAR(50)
        NOT NULL,

    objective_title
        VARCHAR(300)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    period_type
        VARCHAR(20)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    quarter
        INTEGER,

    objective_status
        VARCHAR(20)
        NOT NULL,

    overall_progress_pct
        NUMERIC(7, 2)
        NOT NULL,

    overall_health
        VARCHAR(20)
        NOT NULL,

    overall_confidence_pct
        NUMERIC(7, 2)
        NOT NULL,

    key_result_count
        INTEGER
        NOT NULL,

    achieved_key_result_count
        INTEGER
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_okr_snapshot_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_okr_snapshot_objective
        FOREIGN KEY (
            objective_id
        )
        REFERENCES procurement_strategic_objectives (id),

    CONSTRAINT fk_okr_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_okr_snapshot_progress
        CHECK (
            overall_progress_pct
                BETWEEN 0 AND 100
            AND overall_confidence_pct
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_okr_snapshot_health
        CHECK (
            overall_health IN (
                'ACHIEVED',
                'ON_TRACK',
                'AT_RISK',
                'OFF_TRACK'
            )
        )
);

CREATE TABLE procurement_okr_snapshot_key_results (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    key_result_id
        UUID
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    metric_type
        VARCHAR(20)
        NOT NULL,

    direction
        VARCHAR(20)
        NOT NULL,

    source_type
        VARCHAR(60)
        NOT NULL,

    source_scope_type
        VARCHAR(30),

    source_scope_key
        VARCHAR(160),

    baseline_value
        NUMERIC(24, 4)
        NOT NULL,

    target_value
        NUMERIC(24, 4)
        NOT NULL,

    actual_value
        NUMERIC(24, 4)
        NOT NULL,

    weight_pct
        NUMERIC(7, 2)
        NOT NULL,

    progress_pct
        NUMERIC(7, 2)
        NOT NULL,

    health
        VARCHAR(20)
        NOT NULL,

    confidence_pct
        NUMERIC(7, 2)
        NOT NULL,

    source_observed_at
        TIMESTAMPTZ,

    contribution_count
        INTEGER
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_okr_snapshot_kr_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_okr_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_okr_snapshot_kr_source
        FOREIGN KEY (
            key_result_id
        )
        REFERENCES procurement_key_results (id),

    CONSTRAINT ck_okr_snapshot_kr_progress
        CHECK (
            progress_pct BETWEEN 0 AND 100
            AND confidence_pct BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_okr_snapshot_kr_health
        CHECK (
            health IN (
                'ACHIEVED',
                'ON_TRACK',
                'AT_RISK',
                'OFF_TRACK'
            )
        )
);

CREATE INDEX idx_strategic_objective_status
    ON procurement_strategic_objectives (
        currency,
        fiscal_year,
        status
    );

CREATE INDEX idx_key_result_objective
    ON procurement_key_results (
        objective_id,
        status
    );

CREATE INDEX idx_okr_contribution_key_result
    ON procurement_okr_contributions (
        key_result_id
    );

CREATE INDEX idx_okr_snapshot_objective
    ON procurement_okr_snapshots (
        objective_id,
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_okr_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement OKR snapshots are immutable';
END;
$$;

CREATE TRIGGER trg_okr_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_okr_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_okr_snapshot_mutation();

CREATE TRIGGER trg_okr_snapshot_kr_immutable
BEFORE UPDATE OR DELETE
ON procurement_okr_snapshot_key_results
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_okr_snapshot_mutation();

CREATE TRIGGER trg_audit_strategic_objectives
AFTER INSERT OR UPDATE OR DELETE
ON procurement_strategic_objectives
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_key_results
AFTER INSERT OR UPDATE OR DELETE
ON procurement_key_results
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_okr_contributions
AFTER INSERT OR DELETE
ON procurement_okr_contributions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_okr_snapshots
AFTER INSERT
ON procurement_okr_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
