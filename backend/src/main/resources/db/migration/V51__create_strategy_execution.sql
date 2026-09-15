CREATE SEQUENCE procurement_strategy_execution_commitment_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_strategy_execution_review_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_strategy_execution_commitments (
    id UUID PRIMARY KEY,

    commitment_number
        VARCHAR(60)
        NOT NULL,

    source_roadmap_id
        UUID
        NOT NULL,

    source_roadmap_number
        VARCHAR(60)
        NOT NULL,

    source_roadmap_title
        VARCHAR(300)
        NOT NULL,

    source_initiative_id
        UUID
        NOT NULL,

    source_initiative_number
        VARCHAR(60)
        NOT NULL,

    source_initiative_title
        VARCHAR(300)
        NOT NULL,

    dimension_key
        VARCHAR(50)
        NOT NULL,

    owner_user_id
        UUID
        NOT NULL,

    owner_name_snapshot
        VARCHAR(300)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    planned_start_date
        DATE
        NOT NULL,

    planned_end_date
        DATE
        NOT NULL,

    planned_contribution_points
        NUMERIC(9, 2)
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    actual_start_at
        TIMESTAMPTZ,

    actual_completed_at
        TIMESTAMPTZ,

    cancelled_at
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

    CONSTRAINT uk_strategy_execution_commitment_number
        UNIQUE (
            commitment_number
        ),

    CONSTRAINT uk_strategy_execution_source_initiative
        UNIQUE (
            source_initiative_id
        ),

    CONSTRAINT fk_strategy_execution_roadmap
        FOREIGN KEY (
            source_roadmap_id
        )
        REFERENCES procurement_strategy_roadmaps (id),

    CONSTRAINT fk_strategy_execution_initiative
        FOREIGN KEY (
            source_initiative_id
        )
        REFERENCES procurement_strategy_roadmap_initiatives (id),

    CONSTRAINT fk_strategy_execution_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_strategy_execution_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategy_execution_dimension
        CHECK (
            dimension_key IN (
                'OBJECTIVE_EXECUTION',
                'STRATEGIC_ALIGNMENT',
                'CAPACITY_READINESS',
                'CAPABILITY_READINESS',
                'SUCCESSION_RESILIENCE'
            )
        ),

    CONSTRAINT ck_strategy_execution_status
        CHECK (
            status IN (
                'PLANNED',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_strategy_execution_dates
        CHECK (
            planned_end_date >= planned_start_date
        ),

    CONSTRAINT ck_strategy_execution_contribution
        CHECK (
            planned_contribution_points
                BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_strategy_execution_progress_updates (
    id UUID PRIMARY KEY,

    commitment_id
        UUID
        NOT NULL,

    progress_pct
        NUMERIC(7, 2)
        NOT NULL,

    forecast_end_date
        DATE
        NOT NULL,

    blocker_count
        INTEGER
        NOT NULL,

    blocker_summary
        VARCHAR(3000),

    update_note
        VARCHAR(3000)
        NOT NULL,

    created_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_execution_progress_commitment
        FOREIGN KEY (
            commitment_id
        )
        REFERENCES procurement_strategy_execution_commitments (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_execution_progress_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_execution_progress_pct
        CHECK (
            progress_pct BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_execution_progress_blockers
        CHECK (
            blocker_count >= 0
        )
);

CREATE TABLE procurement_strategy_execution_outcome_reports (
    id UUID PRIMARY KEY,

    commitment_id
        UUID
        NOT NULL,

    reported_contribution_points
        NUMERIC(9, 2)
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

    CONSTRAINT fk_execution_outcome_commitment
        FOREIGN KEY (
            commitment_id
        )
        REFERENCES procurement_strategy_execution_commitments (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_execution_outcome_reporter
        FOREIGN KEY (
            reported_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_execution_outcome_reported_points
        CHECK (
            reported_contribution_points
                BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_strategy_execution_outcome_validations (
    id UUID PRIMARY KEY,

    outcome_report_id
        UUID
        NOT NULL,

    decision
        VARCHAR(20)
        NOT NULL,

    validated_contribution_points
        NUMERIC(9, 2),

    validation_note
        VARCHAR(5000)
        NOT NULL,

    validated_by_user_id
        UUID
        NOT NULL,

    validated_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_execution_outcome_validation
        UNIQUE (
            outcome_report_id
        ),

    CONSTRAINT fk_execution_outcome_validation_report
        FOREIGN KEY (
            outcome_report_id
        )
        REFERENCES procurement_strategy_execution_outcome_reports (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_execution_outcome_validator
        FOREIGN KEY (
            validated_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_execution_outcome_validation_decision
        CHECK (
            decision IN (
                'VALIDATED',
                'REJECTED'
            )
        ),

    CONSTRAINT ck_execution_outcome_validation_value
        CHECK (
            (
                decision =
                    'VALIDATED'
                AND
                validated_contribution_points
                    IS NOT NULL
                AND
                validated_contribution_points
                    BETWEEN 0 AND 100
            )
            OR
            (
                decision =
                    'REJECTED'
                AND
                validated_contribution_points
                    IS NULL
            )
        )
);

CREATE TABLE procurement_strategy_execution_reviews (
    id UUID PRIMARY KEY,

    review_number
        VARCHAR(60)
        NOT NULL,

    roadmap_id
        UUID
        NOT NULL,

    roadmap_number
        VARCHAR(60)
        NOT NULL,

    roadmap_title
        VARCHAR(300)
        NOT NULL,

    commitment_count
        INTEGER
        NOT NULL,

    completed_commitment_count
        INTEGER
        NOT NULL,

    blocked_commitment_count
        INTEGER
        NOT NULL,

    at_risk_commitment_count
        INTEGER
        NOT NULL,

    overdue_commitment_count
        INTEGER
        NOT NULL,

    planned_contribution_points
        NUMERIC(12, 2)
        NOT NULL,

    reported_contribution_points
        NUMERIC(12, 2)
        NOT NULL,

    validated_contribution_points
        NUMERIC(12, 2)
        NOT NULL,

    value_at_risk_points
        NUMERIC(12, 2)
        NOT NULL,

    average_progress_pct
        NUMERIC(7, 2)
        NOT NULL,

    schedule_health_pct
        NUMERIC(7, 2)
        NOT NULL,

    outcome_validation_pct
        NUMERIC(7, 2)
        NOT NULL,

    execution_score
        NUMERIC(7, 2)
        NOT NULL,

    execution_health
        VARCHAR(20)
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_strategy_execution_review_number
        UNIQUE (
            review_number
        ),

    CONSTRAINT fk_strategy_execution_review_roadmap
        FOREIGN KEY (
            roadmap_id
        )
        REFERENCES procurement_strategy_roadmaps (id),

    CONSTRAINT fk_strategy_execution_review_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategy_execution_review_health
        CHECK (
            execution_health IN (
                'HEALTHY',
                'WATCH',
                'AT_RISK',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_strategy_execution_review_scores
        CHECK (
            average_progress_pct BETWEEN 0 AND 100
            AND schedule_health_pct BETWEEN 0 AND 100
            AND outcome_validation_pct BETWEEN 0 AND 100
            AND execution_score BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_strategy_execution_review_items (
    id UUID PRIMARY KEY,

    review_id
        UUID
        NOT NULL,

    commitment_id
        UUID
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

    owner_name
        VARCHAR(300)
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    execution_health
        VARCHAR(20)
        NOT NULL,

    progress_pct
        NUMERIC(7, 2)
        NOT NULL,

    planned_end_date
        DATE
        NOT NULL,

    forecast_end_date
        DATE
        NOT NULL,

    blocker_count
        INTEGER
        NOT NULL,

    planned_contribution_points
        NUMERIC(9, 2)
        NOT NULL,

    reported_contribution_points
        NUMERIC(9, 2)
        NOT NULL,

    validated_contribution_points
        NUMERIC(9, 2)
        NOT NULL,

    value_at_risk_points
        NUMERIC(9, 2)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_strategy_execution_review_item_review
        FOREIGN KEY (
            review_id
        )
        REFERENCES procurement_strategy_execution_reviews (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_strategy_execution_commitment_roadmap
    ON procurement_strategy_execution_commitments (
        source_roadmap_id,
        status,
        planned_end_date
    );

CREATE INDEX idx_strategy_execution_progress_commitment
    ON procurement_strategy_execution_progress_updates (
        commitment_id,
        created_at DESC
    );

CREATE INDEX idx_strategy_execution_outcome_commitment
    ON procurement_strategy_execution_outcome_reports (
        commitment_id,
        reported_at DESC
    );

CREATE INDEX idx_strategy_execution_review_roadmap
    ON procurement_strategy_execution_reviews (
        roadmap_id,
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_execution_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement strategic execution evidence is immutable';
END;
$$;

CREATE TRIGGER trg_execution_progress_immutable
BEFORE UPDATE OR DELETE
ON procurement_strategy_execution_progress_updates
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_execution_evidence_mutation();

CREATE TRIGGER trg_execution_outcome_report_immutable
BEFORE UPDATE OR DELETE
ON procurement_strategy_execution_outcome_reports
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_execution_evidence_mutation();

CREATE TRIGGER trg_execution_outcome_validation_immutable
BEFORE UPDATE OR DELETE
ON procurement_strategy_execution_outcome_validations
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_execution_evidence_mutation();

CREATE TRIGGER trg_execution_review_immutable
BEFORE UPDATE OR DELETE
ON procurement_strategy_execution_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_execution_evidence_mutation();

CREATE TRIGGER trg_execution_review_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_strategy_execution_review_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_execution_evidence_mutation();

CREATE TRIGGER trg_audit_strategy_execution_commitments
AFTER INSERT OR UPDATE
ON procurement_strategy_execution_commitments
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_strategy_execution_progress
AFTER INSERT
ON procurement_strategy_execution_progress_updates
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_strategy_execution_outcomes
AFTER INSERT
ON procurement_strategy_execution_outcome_reports
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_strategy_execution_validations
AFTER INSERT
ON procurement_strategy_execution_outcome_validations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_strategy_execution_reviews
AFTER INSERT
ON procurement_strategy_execution_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
