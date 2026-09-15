CREATE SEQUENCE procurement_strategy_recovery_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_strategy_recovery_review_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_strategy_recovery_cases (
    id UUID PRIMARY KEY,

    recovery_number
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

    execution_owner_name
        VARCHAR(300)
        NOT NULL,

    recovery_owner_user_id
        UUID
        NOT NULL,

    recovery_owner_name_snapshot
        VARCHAR(300)
        NOT NULL,

    severity
        VARCHAR(20)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    recovery_objective
        VARCHAR(4000)
        NOT NULL,

    target_recovery_date
        DATE
        NOT NULL,

    baseline_execution_health
        VARCHAR(30)
        NOT NULL,

    baseline_progress_pct
        NUMERIC(7, 2)
        NOT NULL,

    baseline_forecast_end_date
        DATE
        NOT NULL,

    baseline_blocker_count
        INTEGER
        NOT NULL,

    baseline_planned_contribution_points
        NUMERIC(9, 2)
        NOT NULL,

    baseline_validated_contribution_points
        NUMERIC(9, 2)
        NOT NULL,

    baseline_value_at_risk_points
        NUMERIC(9, 2)
        NOT NULL,

    baseline_risk_score
        NUMERIC(7, 2)
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

    CONSTRAINT uk_strategy_recovery_number
        UNIQUE (
            recovery_number
        ),

    CONSTRAINT fk_strategy_recovery_commitment
        FOREIGN KEY (
            commitment_id
        )
        REFERENCES procurement_strategy_execution_commitments (id),

    CONSTRAINT fk_strategy_recovery_roadmap
        FOREIGN KEY (
            roadmap_id
        )
        REFERENCES procurement_strategy_roadmaps (id),

    CONSTRAINT fk_strategy_recovery_owner
        FOREIGN KEY (
            recovery_owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_strategy_recovery_verifier
        FOREIGN KEY (
            verified_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_strategy_recovery_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_strategy_recovery_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategy_recovery_severity
        CHECK (
            severity IN (
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_strategy_recovery_status
        CHECK (
            status IN (
                'OPEN',
                'IN_RECOVERY',
                'READY_FOR_VERIFICATION',
                'VERIFIED',
                'CLOSED'
            )
        ),

    CONSTRAINT ck_strategy_recovery_progress
        CHECK (
            baseline_progress_pct
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_strategy_recovery_counts
        CHECK (
            baseline_blocker_count >= 0
        ),

    CONSTRAINT ck_strategy_recovery_points
        CHECK (
            baseline_planned_contribution_points
                BETWEEN 0 AND 100
            AND
            baseline_validated_contribution_points
                BETWEEN 0 AND 100
            AND
            baseline_value_at_risk_points
                BETWEEN 0 AND 100
            AND
            baseline_risk_score
                BETWEEN 0 AND 100
        )
);

CREATE UNIQUE INDEX uk_strategy_recovery_active_commitment
    ON procurement_strategy_recovery_cases (
        commitment_id
    )
    WHERE status
        <> 'CLOSED';

CREATE TABLE procurement_strategy_recovery_actions (
    id UUID PRIMARY KEY,

    recovery_case_id
        UUID
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    description
        VARCHAR(4000),

    owner_user_id
        UUID
        NOT NULL,

    owner_name_snapshot
        VARCHAR(300)
        NOT NULL,

    due_date
        DATE
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    completion_evidence
        VARCHAR(5000),

    created_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    started_at
        TIMESTAMPTZ,

    completed_at
        TIMESTAMPTZ,

    cancelled_at
        TIMESTAMPTZ,

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    version
        BIGINT
        NOT NULL
        DEFAULT 0,

    CONSTRAINT fk_strategy_recovery_action_case
        FOREIGN KEY (
            recovery_case_id
        )
        REFERENCES procurement_strategy_recovery_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_strategy_recovery_action_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_strategy_recovery_action_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategy_recovery_action_status
        CHECK (
            status IN (
                'PLANNED',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        )
);

CREATE TABLE procurement_strategy_recovery_checkpoints (
    id UUID PRIMARY KEY,

    recovery_case_id
        UUID
        NOT NULL,

    commitment_id
        UUID
        NOT NULL,

    execution_health
        VARCHAR(30)
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

    validated_contribution_points
        NUMERIC(9, 2)
        NOT NULL,

    value_at_risk_points
        NUMERIC(9, 2)
        NOT NULL,

    current_risk_score
        NUMERIC(7, 2)
        NOT NULL,

    recovery_score
        NUMERIC(7, 2)
        NOT NULL,

    effectiveness_pct
        NUMERIC(7, 2)
        NOT NULL,

    recovery_health
        VARCHAR(20)
        NOT NULL,

    checkpoint_note
        VARCHAR(5000)
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_strategy_recovery_checkpoint_case
        FOREIGN KEY (
            recovery_case_id
        )
        REFERENCES procurement_strategy_recovery_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_strategy_recovery_checkpoint_commitment
        FOREIGN KEY (
            commitment_id
        )
        REFERENCES procurement_strategy_execution_commitments (id),

    CONSTRAINT fk_strategy_recovery_checkpoint_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategy_recovery_checkpoint_health
        CHECK (
            recovery_health IN (
                'RECOVERED',
                'IMPROVING',
                'WATCH',
                'INEFFECTIVE'
            )
        ),

    CONSTRAINT ck_strategy_recovery_checkpoint_scores
        CHECK (
            progress_pct BETWEEN 0 AND 100
            AND blocker_count >= 0
            AND validated_contribution_points BETWEEN 0 AND 100
            AND value_at_risk_points BETWEEN 0 AND 100
            AND current_risk_score BETWEEN 0 AND 100
            AND recovery_score BETWEEN 0 AND 100
            AND effectiveness_pct BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_strategy_recovery_escalations (
    id UUID PRIMARY KEY,

    recovery_case_id
        UUID
        NOT NULL,

    escalation_level
        VARCHAR(20)
        NOT NULL,

    reason
        VARCHAR(4000)
        NOT NULL,

    escalated_by_user_id
        UUID
        NOT NULL,

    escalated_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_strategy_recovery_escalation_case
        FOREIGN KEY (
            recovery_case_id
        )
        REFERENCES procurement_strategy_recovery_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_strategy_recovery_escalation_user
        FOREIGN KEY (
            escalated_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategy_recovery_escalation_level
        CHECK (
            escalation_level IN (
                'MANAGER',
                'EXECUTIVE'
            )
        )
);

CREATE TABLE procurement_strategy_recovery_reviews (
    id UUID PRIMARY KEY,

    review_number
        VARCHAR(60)
        NOT NULL,

    open_case_count
        INTEGER
        NOT NULL,

    in_recovery_case_count
        INTEGER
        NOT NULL,

    ready_for_verification_count
        INTEGER
        NOT NULL,

    verified_case_count
        INTEGER
        NOT NULL,

    critical_case_count
        INTEGER
        NOT NULL,

    overdue_action_count
        INTEGER
        NOT NULL,

    escalation_count
        INTEGER
        NOT NULL,

    total_baseline_value_at_risk_points
        NUMERIC(12, 2)
        NOT NULL,

    total_current_value_at_risk_points
        NUMERIC(12, 2)
        NOT NULL,

    average_effectiveness_pct
        NUMERIC(7, 2)
        NOT NULL,

    average_recovery_score
        NUMERIC(7, 2)
        NOT NULL,

    portfolio_health
        VARCHAR(20)
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_strategy_recovery_review_number
        UNIQUE (
            review_number
        ),

    CONSTRAINT fk_strategy_recovery_review_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategy_recovery_review_health
        CHECK (
            portfolio_health IN (
                'RECOVERED',
                'IMPROVING',
                'WATCH',
                'INEFFECTIVE'
            )
        ),

    CONSTRAINT ck_strategy_recovery_review_scores
        CHECK (
            average_effectiveness_pct BETWEEN 0 AND 100
            AND average_recovery_score BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_strategy_recovery_review_items (
    id UUID PRIMARY KEY,

    review_id
        UUID
        NOT NULL,

    recovery_case_id
        UUID
        NOT NULL,

    recovery_number
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

    recovery_owner_name
        VARCHAR(300)
        NOT NULL,

    severity
        VARCHAR(20)
        NOT NULL,

    recovery_status
        VARCHAR(30)
        NOT NULL,

    baseline_risk_score
        NUMERIC(7, 2)
        NOT NULL,

    current_risk_score
        NUMERIC(7, 2)
        NOT NULL,

    recovery_score
        NUMERIC(7, 2)
        NOT NULL,

    effectiveness_pct
        NUMERIC(7, 2)
        NOT NULL,

    recovery_health
        VARCHAR(20)
        NOT NULL,

    current_progress_pct
        NUMERIC(7, 2)
        NOT NULL,

    current_forecast_end_date
        DATE
        NOT NULL,

    current_blocker_count
        INTEGER
        NOT NULL,

    current_value_at_risk_points
        NUMERIC(9, 2)
        NOT NULL,

    verification_eligible
        BOOLEAN
        NOT NULL,

    open_action_count
        INTEGER
        NOT NULL,

    overdue_action_count
        INTEGER
        NOT NULL,

    escalation_count
        INTEGER
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_strategy_recovery_review_item_review
        FOREIGN KEY (
            review_id
        )
        REFERENCES procurement_strategy_recovery_reviews (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_strategy_recovery_case_commitment
    ON procurement_strategy_recovery_cases (
        commitment_id,
        status
    );

CREATE INDEX idx_strategy_recovery_case_status
    ON procurement_strategy_recovery_cases (
        severity,
        status,
        target_recovery_date
    );

CREATE INDEX idx_strategy_recovery_action_case
    ON procurement_strategy_recovery_actions (
        recovery_case_id,
        status,
        due_date
    );

CREATE INDEX idx_strategy_recovery_checkpoint_case
    ON procurement_strategy_recovery_checkpoints (
        recovery_case_id,
        captured_at DESC
    );

CREATE INDEX idx_strategy_recovery_escalation_case
    ON procurement_strategy_recovery_escalations (
        recovery_case_id,
        escalated_at DESC
    );

CREATE INDEX idx_strategy_recovery_review_capture
    ON procurement_strategy_recovery_reviews (
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_recovery_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement strategy recovery evidence is immutable';
END;
$$;

CREATE TRIGGER trg_strategy_recovery_checkpoint_immutable
BEFORE UPDATE OR DELETE
ON procurement_strategy_recovery_checkpoints
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_recovery_evidence_mutation();

CREATE TRIGGER trg_strategy_recovery_escalation_immutable
BEFORE UPDATE OR DELETE
ON procurement_strategy_recovery_escalations
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_recovery_evidence_mutation();

CREATE TRIGGER trg_strategy_recovery_review_immutable
BEFORE UPDATE OR DELETE
ON procurement_strategy_recovery_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_recovery_evidence_mutation();

CREATE TRIGGER trg_strategy_recovery_review_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_strategy_recovery_review_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_recovery_evidence_mutation();

CREATE TRIGGER trg_audit_strategy_recovery_cases
AFTER INSERT OR UPDATE
ON procurement_strategy_recovery_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_strategy_recovery_actions
AFTER INSERT OR UPDATE
ON procurement_strategy_recovery_actions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_strategy_recovery_checkpoints
AFTER INSERT
ON procurement_strategy_recovery_checkpoints
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_strategy_recovery_escalations
AFTER INSERT
ON procurement_strategy_recovery_escalations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_strategy_recovery_reviews
AFTER INSERT
ON procurement_strategy_recovery_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
