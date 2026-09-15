CREATE SEQUENCE procurement_board_scorecard_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_board_scorecard_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number
        VARCHAR(60)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    objective_execution_score
        NUMERIC(7, 2)
        NOT NULL,

    strategic_alignment_score
        NUMERIC(7, 2)
        NOT NULL,

    capacity_score
        NUMERIC(7, 2)
        NOT NULL,

    capability_score
        NUMERIC(7, 2)
        NOT NULL,

    succession_score
        NUMERIC(7, 2)
        NOT NULL,

    overall_score
        NUMERIC(7, 2)
        NOT NULL,

    overall_health
        VARCHAR(20)
        NOT NULL,

    previous_snapshot_id
        UUID,

    previous_overall_score
        NUMERIC(7, 2),

    score_delta
        NUMERIC(9, 2)
        NOT NULL,

    movement
        VARCHAR(20)
        NOT NULL,

    strategic_objective_count
        INTEGER
        NOT NULL,

    off_track_objective_count
        INTEGER
        NOT NULL,

    unaligned_work_count
        INTEGER
        NOT NULL,

    overloaded_member_count
        INTEGER
        NOT NULL,

    critical_capability_gap_count
        INTEGER
        NOT NULL,

    succession_spof_count
        INTEGER
        NOT NULL,

    exception_count
        INTEGER
        NOT NULL,

    critical_exception_count
        INTEGER
        NOT NULL,

    generated_summary
        VARCHAR(6000)
        NOT NULL,

    board_commentary
        VARCHAR(4000),

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_board_scorecard_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_board_scorecard_previous
        FOREIGN KEY (
            previous_snapshot_id
        )
        REFERENCES procurement_board_scorecard_snapshots (id),

    CONSTRAINT fk_board_scorecard_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_board_scorecard_health
        CHECK (
            overall_health IN (
                'EXCELLENT',
                'STRONG',
                'WATCH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_board_scorecard_movement
        CHECK (
            movement IN (
                'BASELINE',
                'IMPROVING',
                'STABLE',
                'DETERIORATING'
            )
        ),

    CONSTRAINT ck_board_scorecard_scores
        CHECK (
            objective_execution_score BETWEEN 0 AND 100
            AND strategic_alignment_score BETWEEN 0 AND 100
            AND capacity_score BETWEEN 0 AND 100
            AND capability_score BETWEEN 0 AND 100
            AND succession_score BETWEEN 0 AND 100
            AND overall_score BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_board_scorecard_dimensions (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    dimension_key
        VARCHAR(50)
        NOT NULL,

    dimension_label
        VARCHAR(160)
        NOT NULL,

    weight_pct
        NUMERIC(7, 2)
        NOT NULL,

    score
        NUMERIC(7, 2)
        NOT NULL,

    weighted_contribution
        NUMERIC(9, 2)
        NOT NULL,

    health
        VARCHAR(20)
        NOT NULL,

    previous_score
        NUMERIC(7, 2),

    score_delta
        NUMERIC(9, 2)
        NOT NULL,

    source_detail
        VARCHAR(3000)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_board_dimension_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_board_scorecard_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_board_dimension
        UNIQUE (
            snapshot_id,
            dimension_key
        ),

    CONSTRAINT ck_board_dimension_key
        CHECK (
            dimension_key IN (
                'OBJECTIVE_EXECUTION',
                'STRATEGIC_ALIGNMENT',
                'CAPACITY_READINESS',
                'CAPABILITY_READINESS',
                'SUCCESSION_RESILIENCE'
            )
        ),

    CONSTRAINT ck_board_dimension_health
        CHECK (
            health IN (
                'EXCELLENT',
                'STRONG',
                'WATCH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_board_dimension_values
        CHECK (
            weight_pct > 0
            AND weight_pct <= 100
            AND score BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_board_scorecard_exceptions (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    stable_key
        VARCHAR(180)
        NOT NULL,

    exception_type
        VARCHAR(60)
        NOT NULL,

    severity
        VARCHAR(20)
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    detail
        VARCHAR(3000)
        NOT NULL,

    occurrence_count
        INTEGER
        NOT NULL,

    metric_value
        NUMERIC(19, 2)
        NOT NULL,

    source_route
        VARCHAR(300)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_board_exception_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_board_scorecard_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_board_exception
        UNIQUE (
            snapshot_id,
            stable_key
        ),

    CONSTRAINT ck_board_exception_type
        CHECK (
            exception_type IN (
                'OBJECTIVE_OFF_TRACK',
                'UNALIGNED_STRATEGIC_WORK',
                'STRATEGIC_DEADLINE_CONFLICT',
                'CAPACITY_GAP',
                'CAPACITY_OVERLOAD',
                'CAPACITY_DEADLINE_PRESSURE',
                'CAPABILITY_CRITICAL_GAP',
                'CAPABILITY_REQUIREMENT_GAP',
                'SUCCESSION_SINGLE_POINT_FAILURE',
                'SUCCESSION_CRITICAL_EXPOSURE',
                'MISSING_OBJECTIVES',
                'MISSING_CAPACITY_PROFILE',
                'MISSING_SUCCESSION_POLICY'
            )
        ),

    CONSTRAINT ck_board_exception_severity
        CHECK (
            severity IN (
                'INFO',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_board_exception_count
        CHECK (
            occurrence_count >= 0
        )
);

CREATE INDEX idx_board_scorecard_scope
    ON procurement_board_scorecard_snapshots (
        currency,
        fiscal_year,
        captured_at DESC
    );

CREATE INDEX idx_board_dimension_snapshot
    ON procurement_board_scorecard_dimensions (
        snapshot_id,
        dimension_key
    );

CREATE INDEX idx_board_exception_snapshot
    ON procurement_board_scorecard_exceptions (
        snapshot_id,
        severity
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_board_scorecard_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement board scorecard snapshots are immutable';
END;
$$;

CREATE TRIGGER trg_board_scorecard_immutable
BEFORE UPDATE OR DELETE
ON procurement_board_scorecard_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_board_scorecard_mutation();

CREATE TRIGGER trg_board_dimension_immutable
BEFORE UPDATE OR DELETE
ON procurement_board_scorecard_dimensions
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_board_scorecard_mutation();

CREATE TRIGGER trg_board_exception_immutable
BEFORE UPDATE OR DELETE
ON procurement_board_scorecard_exceptions
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_board_scorecard_mutation();

CREATE TRIGGER trg_audit_board_scorecard
AFTER INSERT
ON procurement_board_scorecard_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
