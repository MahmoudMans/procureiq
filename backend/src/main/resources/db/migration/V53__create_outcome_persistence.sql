CREATE SEQUENCE procurement_outcome_persistence_plan_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_outcome_persistence_review_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_outcome_persistence_plans (
    id UUID PRIMARY KEY,

    plan_number
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

    persistence_owner_user_id
        UUID
        NOT NULL,

    persistence_owner_name_snapshot
        VARCHAR(300)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    baseline_validated_contribution_points
        NUMERIC(9, 2)
        NOT NULL,

    observation_start_date
        DATE
        NOT NULL,

    observation_end_date
        DATE
        NOT NULL,

    minimum_persistence_pct
        NUMERIC(7, 2)
        NOT NULL,

    persistence_objective
        VARCHAR(4000)
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

    CONSTRAINT uk_outcome_persistence_plan_number
        UNIQUE (
            plan_number
        ),

    CONSTRAINT fk_outcome_persistence_commitment
        FOREIGN KEY (
            commitment_id
        )
        REFERENCES procurement_strategy_execution_commitments (id),

    CONSTRAINT fk_outcome_persistence_roadmap
        FOREIGN KEY (
            roadmap_id
        )
        REFERENCES procurement_strategy_roadmaps (id),

    CONSTRAINT fk_outcome_persistence_owner
        FOREIGN KEY (
            persistence_owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_outcome_persistence_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_outcome_persistence_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_outcome_persistence_plan_status
        CHECK (
            status IN (
                'ACTIVE',
                'READY_FOR_REVIEW',
                'IN_REMEDIATION',
                'SUSTAINED',
                'CLOSED'
            )
        ),

    CONSTRAINT ck_outcome_persistence_window
        CHECK (
            observation_end_date
                >= observation_start_date
        ),

    CONSTRAINT ck_outcome_persistence_baseline
        CHECK (
            baseline_validated_contribution_points
                > 0
            AND
            baseline_validated_contribution_points
                <= 100
        ),

    CONSTRAINT ck_outcome_persistence_minimum
        CHECK (
            minimum_persistence_pct
                BETWEEN 1 AND 100
        )
);

CREATE UNIQUE INDEX uk_outcome_persistence_active_commitment
    ON procurement_outcome_persistence_plans (
        commitment_id
    )
    WHERE status
        <> 'CLOSED';

CREATE TABLE procurement_outcome_persistence_observations (
    id UUID PRIMARY KEY,

    plan_id
        UUID
        NOT NULL,

    observed_on
        DATE
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

    CONSTRAINT fk_outcome_persistence_observation_plan
        FOREIGN KEY (
            plan_id
        )
        REFERENCES procurement_outcome_persistence_plans (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_outcome_persistence_observation_reporter
        FOREIGN KEY (
            reported_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_outcome_persistence_observation_points
        CHECK (
            reported_contribution_points
                BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_outcome_persistence_validations (
    id UUID PRIMARY KEY,

    observation_id
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

    CONSTRAINT uk_outcome_persistence_validation
        UNIQUE (
            observation_id
        ),

    CONSTRAINT fk_outcome_persistence_validation_observation
        FOREIGN KEY (
            observation_id
        )
        REFERENCES procurement_outcome_persistence_observations (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_outcome_persistence_validation_user
        FOREIGN KEY (
            validated_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_outcome_persistence_validation_decision
        CHECK (
            decision IN (
                'VALIDATED',
                'REJECTED'
            )
        ),

    CONSTRAINT ck_outcome_persistence_validation_points
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

CREATE TABLE procurement_outcome_persistence_controls (
    id UUID PRIMARY KEY,

    plan_id
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

    CONSTRAINT fk_outcome_persistence_control_plan
        FOREIGN KEY (
            plan_id
        )
        REFERENCES procurement_outcome_persistence_plans (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_outcome_persistence_control_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_outcome_persistence_control_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_outcome_persistence_control_status
        CHECK (
            status IN (
                'PLANNED',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        )
);

CREATE TABLE procurement_outcome_persistence_verifications (
    id UUID PRIMARY KEY,

    plan_id
        UUID
        NOT NULL,

    decision
        VARCHAR(30)
        NOT NULL,

    persistence_pct
        NUMERIC(7, 2)
        NOT NULL,

    decay_points
        NUMERIC(9, 2)
        NOT NULL,

    persistence_health
        VARCHAR(20)
        NOT NULL,

    verification_note
        VARCHAR(5000)
        NOT NULL,

    verified_by_user_id
        UUID
        NOT NULL,

    verified_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_outcome_persistence_verification_plan
        FOREIGN KEY (
            plan_id
        )
        REFERENCES procurement_outcome_persistence_plans (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_outcome_persistence_verification_user
        FOREIGN KEY (
            verified_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_outcome_persistence_verification_decision
        CHECK (
            decision IN (
                'SUSTAINED',
                'REMEDIATION_REQUIRED'
            )
        ),

    CONSTRAINT ck_outcome_persistence_verification_health
        CHECK (
            persistence_health IN (
                'UNASSESSED',
                'SUSTAINED',
                'WATCH',
                'DECAYING',
                'REGRESSED'
            )
        ),

    CONSTRAINT ck_outcome_persistence_verification_values
        CHECK (
            persistence_pct BETWEEN 0 AND 100
            AND decay_points BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_outcome_persistence_reviews (
    id UUID PRIMARY KEY,

    review_number
        VARCHAR(60)
        NOT NULL,

    active_plan_count
        INTEGER
        NOT NULL,

    remediation_plan_count
        INTEGER
        NOT NULL,

    ready_for_review_count
        INTEGER
        NOT NULL,

    sustained_plan_count
        INTEGER
        NOT NULL,

    due_observation_count
        INTEGER
        NOT NULL,

    decayed_plan_count
        INTEGER
        NOT NULL,

    overdue_control_count
        INTEGER
        NOT NULL,

    assessed_baseline_points
        NUMERIC(12, 2)
        NOT NULL,

    current_validated_points
        NUMERIC(12, 2)
        NOT NULL,

    total_decay_points
        NUMERIC(12, 2)
        NOT NULL,

    average_persistence_pct
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

    CONSTRAINT uk_outcome_persistence_review_number
        UNIQUE (
            review_number
        ),

    CONSTRAINT fk_outcome_persistence_review_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_outcome_persistence_review_health
        CHECK (
            portfolio_health IN (
                'UNASSESSED',
                'SUSTAINED',
                'WATCH',
                'DECAYING',
                'REGRESSED'
            )
        ),

    CONSTRAINT ck_outcome_persistence_review_pct
        CHECK (
            average_persistence_pct
                BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_outcome_persistence_review_items (
    id UUID PRIMARY KEY,

    review_id
        UUID
        NOT NULL,

    plan_id
        UUID
        NOT NULL,

    plan_number
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

    persistence_owner_name
        VARCHAR(300)
        NOT NULL,

    plan_status
        VARCHAR(30)
        NOT NULL,

    baseline_validated_points
        NUMERIC(9, 2)
        NOT NULL,

    current_validated_points
        NUMERIC(9, 2)
        NOT NULL,

    persistence_pct
        NUMERIC(7, 2)
        NOT NULL,

    decay_points
        NUMERIC(9, 2)
        NOT NULL,

    persistence_health
        VARCHAR(20)
        NOT NULL,

    observation_due
        BOOLEAN
        NOT NULL,

    verification_eligible
        BOOLEAN
        NOT NULL,

    open_control_count
        INTEGER
        NOT NULL,

    overdue_control_count
        INTEGER
        NOT NULL,

    observation_count
        INTEGER
        NOT NULL,

    verification_count
        INTEGER
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_outcome_persistence_review_item_review
        FOREIGN KEY (
            review_id
        )
        REFERENCES procurement_outcome_persistence_reviews (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_outcome_persistence_plan_commitment
    ON procurement_outcome_persistence_plans (
        commitment_id,
        status
    );

CREATE INDEX idx_outcome_persistence_plan_status
    ON procurement_outcome_persistence_plans (
        status,
        observation_end_date
    );

CREATE INDEX idx_outcome_persistence_observation_plan
    ON procurement_outcome_persistence_observations (
        plan_id,
        observed_on DESC,
        reported_at DESC
    );

CREATE INDEX idx_outcome_persistence_control_plan
    ON procurement_outcome_persistence_controls (
        plan_id,
        status,
        due_date
    );

CREATE INDEX idx_outcome_persistence_verification_plan
    ON procurement_outcome_persistence_verifications (
        plan_id,
        verified_at DESC
    );

CREATE INDEX idx_outcome_persistence_review_capture
    ON procurement_outcome_persistence_reviews (
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_outcome_persistence_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement outcome persistence evidence is immutable';
END;
$$;

CREATE TRIGGER trg_outcome_persistence_observation_immutable
BEFORE UPDATE OR DELETE
ON procurement_outcome_persistence_observations
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_outcome_persistence_evidence_mutation();

CREATE TRIGGER trg_outcome_persistence_validation_immutable
BEFORE UPDATE OR DELETE
ON procurement_outcome_persistence_validations
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_outcome_persistence_evidence_mutation();

CREATE TRIGGER trg_outcome_persistence_verification_immutable
BEFORE UPDATE OR DELETE
ON procurement_outcome_persistence_verifications
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_outcome_persistence_evidence_mutation();

CREATE TRIGGER trg_outcome_persistence_review_immutable
BEFORE UPDATE OR DELETE
ON procurement_outcome_persistence_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_outcome_persistence_evidence_mutation();

CREATE TRIGGER trg_outcome_persistence_review_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_outcome_persistence_review_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_outcome_persistence_evidence_mutation();

CREATE TRIGGER trg_audit_outcome_persistence_plans
AFTER INSERT OR UPDATE
ON procurement_outcome_persistence_plans
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_outcome_persistence_observations
AFTER INSERT
ON procurement_outcome_persistence_observations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_outcome_persistence_validations
AFTER INSERT
ON procurement_outcome_persistence_validations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_outcome_persistence_controls
AFTER INSERT OR UPDATE
ON procurement_outcome_persistence_controls
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_outcome_persistence_verifications
AFTER INSERT
ON procurement_outcome_persistence_verifications
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_outcome_persistence_reviews
AFTER INSERT
ON procurement_outcome_persistence_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
