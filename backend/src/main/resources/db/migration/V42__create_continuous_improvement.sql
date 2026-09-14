CREATE SEQUENCE procurement_improvement_initiative_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_improvement_initiatives (
    id UUID PRIMARY KEY,

    initiative_number
        VARCHAR(50)
        NOT NULL,

    title
        VARCHAR(260)
        NOT NULL,

    description
        VARCHAR(4000)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    priority
        VARCHAR(20)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    owner_user_id
        UUID
        NOT NULL,

    source_snapshot_id
        UUID
        NOT NULL,

    scope_type
        VARCHAR(30)
        NOT NULL,

    scope_key
        VARCHAR(160)
        NOT NULL,

    scope_label
        VARCHAR(240)
        NOT NULL,

    baseline_active_count
        BIGINT
        NOT NULL,

    baseline_sla_overdue_count
        BIGINT
        NOT NULL,

    baseline_persistent_count
        BIGINT
        NOT NULL,

    baseline_resolved_count
        BIGINT
        NOT NULL,

    baseline_sla_attainment_pct
        NUMERIC(7, 2)
        NOT NULL,

    baseline_avg_resolution_hours
        NUMERIC(12, 2)
        NOT NULL,

    baseline_avg_active_age_days
        NUMERIC(12, 2)
        NOT NULL,

    baseline_active_exposure
        NUMERIC(19, 2)
        NOT NULL,

    target_sla_attainment_pct
        NUMERIC(7, 2)
        NOT NULL,

    target_sla_overdue_reduction_pct
        NUMERIC(7, 2)
        NOT NULL,

    target_persistent_reduction_pct
        NUMERIC(7, 2)
        NOT NULL,

    target_resolution_hours_reduction_pct
        NUMERIC(7, 2)
        NOT NULL,

    target_exposure_reduction_pct
        NUMERIC(7, 2)
        NOT NULL,

    target_date
        DATE
        NOT NULL,

    notes
        VARCHAR(3000),

    started_at
        TIMESTAMPTZ,

    completed_at
        TIMESTAMPTZ,

    cancelled_at
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

    CONSTRAINT uk_improvement_initiative_number
        UNIQUE (
            initiative_number
        ),

    CONSTRAINT fk_improvement_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_improvement_source_snapshot
        FOREIGN KEY (
            source_snapshot_id
        )
        REFERENCES procurement_operating_rhythm_snapshots (id),

    CONSTRAINT ck_improvement_priority
        CHECK (
            priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_improvement_status
        CHECK (
            status IN (
                'DRAFT',
                'ACTIVE',
                'ON_HOLD',
                'COMPLETED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_improvement_scope_type
        CHECK (
            scope_type IN (
                'OVERALL',
                'DOMAIN',
                'OWNER',
                'SEVERITY',
                'EXCEPTION_TYPE'
            )
        ),

    CONSTRAINT ck_improvement_baseline_nonnegative
        CHECK (
            baseline_active_count >= 0
            AND baseline_sla_overdue_count >= 0
            AND baseline_persistent_count >= 0
            AND baseline_resolved_count >= 0
            AND baseline_sla_attainment_pct BETWEEN 0 AND 100
            AND baseline_avg_resolution_hours >= 0
            AND baseline_avg_active_age_days >= 0
            AND baseline_active_exposure >= 0
        ),

    CONSTRAINT ck_improvement_targets
        CHECK (
            target_sla_attainment_pct BETWEEN 0 AND 100
            AND target_sla_overdue_reduction_pct BETWEEN 0 AND 100
            AND target_persistent_reduction_pct BETWEEN 0 AND 100
            AND target_resolution_hours_reduction_pct BETWEEN 0 AND 100
            AND target_exposure_reduction_pct BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_improvement_actions (
    id UUID PRIMARY KEY,

    initiative_id
        UUID
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    description
        VARCHAR(3000),

    owner_user_id
        UUID
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    due_date
        DATE
        NOT NULL,

    completion_note
        VARCHAR(3000),

    started_at
        TIMESTAMPTZ,

    completed_at
        TIMESTAMPTZ,

    cancelled_at
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

    CONSTRAINT fk_improvement_action_initiative
        FOREIGN KEY (
            initiative_id
        )
        REFERENCES procurement_improvement_initiatives (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_improvement_action_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_improvement_action_status
        CHECK (
            status IN (
                'PLANNED',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        )
);

CREATE TABLE procurement_improvement_checkpoints (
    id UUID PRIMARY KEY,

    initiative_id
        UUID
        NOT NULL,

    snapshot_id
        UUID
        NOT NULL,

    current_active_count
        BIGINT
        NOT NULL,

    current_sla_overdue_count
        BIGINT
        NOT NULL,

    current_persistent_count
        BIGINT
        NOT NULL,

    current_resolved_count
        BIGINT
        NOT NULL,

    current_sla_attainment_pct
        NUMERIC(7, 2)
        NOT NULL,

    current_avg_resolution_hours
        NUMERIC(12, 2)
        NOT NULL,

    current_avg_active_age_days
        NUMERIC(12, 2)
        NOT NULL,

    current_active_exposure
        NUMERIC(19, 2)
        NOT NULL,

    sla_attainment_delta
        NUMERIC(9, 2)
        NOT NULL,

    sla_overdue_reduction_pct
        NUMERIC(9, 2)
        NOT NULL,

    persistent_reduction_pct
        NUMERIC(9, 2)
        NOT NULL,

    resolution_hours_reduction_pct
        NUMERIC(9, 2)
        NOT NULL,

    exposure_reduction_pct
        NUMERIC(9, 2)
        NOT NULL,

    targets_met_count
        INTEGER
        NOT NULL,

    achievement_score
        NUMERIC(9, 2)
        NOT NULL,

    outcome
        VARCHAR(30)
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_improvement_checkpoint_initiative
        FOREIGN KEY (
            initiative_id
        )
        REFERENCES procurement_improvement_initiatives (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_improvement_checkpoint_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_operating_rhythm_snapshots (id),

    CONSTRAINT fk_improvement_checkpoint_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_improvement_checkpoint_snapshot
        UNIQUE (
            initiative_id,
            snapshot_id
        ),

    CONSTRAINT ck_improvement_checkpoint_outcome
        CHECK (
            outcome IN (
                'IMPROVED',
                'MIXED',
                'NO_CHANGE',
                'REGRESSED'
            )
        ),

    CONSTRAINT ck_improvement_checkpoint_target_count
        CHECK (
            targets_met_count
                BETWEEN 0 AND 5
        )
);

CREATE INDEX idx_improvement_initiative_status
    ON procurement_improvement_initiatives (
        currency,
        status,
        priority,
        target_date
    );

CREATE INDEX idx_improvement_initiative_scope
    ON procurement_improvement_initiatives (
        source_snapshot_id,
        scope_type,
        scope_key
    );

CREATE INDEX idx_improvement_action_initiative
    ON procurement_improvement_actions (
        initiative_id,
        status,
        due_date
    );

CREATE INDEX idx_improvement_checkpoint_initiative
    ON procurement_improvement_checkpoints (
        initiative_id,
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_improvement_checkpoint_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Continuous-improvement checkpoints are immutable';
END;
$$;

CREATE TRIGGER trg_improvement_checkpoint_immutable
BEFORE UPDATE OR DELETE
ON procurement_improvement_checkpoints
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_improvement_checkpoint_mutation();

CREATE TRIGGER trg_audit_improvement_initiatives
AFTER INSERT OR UPDATE OR DELETE
ON procurement_improvement_initiatives
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_improvement_actions
AFTER INSERT OR UPDATE OR DELETE
ON procurement_improvement_actions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_improvement_checkpoints
AFTER INSERT
ON procurement_improvement_checkpoints
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
