CREATE SEQUENCE procurement_capability_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_capability_skills (
    id UUID PRIMARY KEY,

    code
        VARCHAR(80)
        NOT NULL,

    name
        VARCHAR(220)
        NOT NULL,

    category
        VARCHAR(120)
        NOT NULL,

    description
        VARCHAR(3000),

    active
        BOOLEAN
        NOT NULL
        DEFAULT TRUE,

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

    CONSTRAINT uk_capability_skill_code
        UNIQUE (
            code
        ),

    CONSTRAINT fk_capability_skill_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id)
);

CREATE TABLE procurement_user_capabilities (
    id UUID PRIMARY KEY,

    user_id
        UUID
        NOT NULL,

    skill_id
        UUID
        NOT NULL,

    proficiency_level
        INTEGER
        NOT NULL,

    evidence_note
        VARCHAR(3000)
        NOT NULL,

    assessed_by_user_id
        UUID
        NOT NULL,

    assessed_at
        TIMESTAMPTZ
        NOT NULL,

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    version
        BIGINT
        NOT NULL
        DEFAULT 0,

    CONSTRAINT fk_user_capability_user
        FOREIGN KEY (
            user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_user_capability_skill
        FOREIGN KEY (
            skill_id
        )
        REFERENCES procurement_capability_skills (id),

    CONSTRAINT fk_user_capability_assessor
        FOREIGN KEY (
            assessed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_user_capability_skill
        UNIQUE (
            user_id,
            skill_id
        ),

    CONSTRAINT ck_user_capability_proficiency
        CHECK (
            proficiency_level
                BETWEEN 1 AND 5
        )
);

CREATE TABLE procurement_work_capability_requirements (
    id UUID PRIMARY KEY,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    source_type
        VARCHAR(40)
        NOT NULL,

    source_entity_id
        UUID
        NOT NULL,

    source_reference_snapshot
        VARCHAR(180)
        NOT NULL,

    source_title_snapshot
        VARCHAR(500)
        NOT NULL,

    source_status_snapshot
        VARCHAR(80)
        NOT NULL,

    skill_id
        UUID
        NOT NULL,

    required_proficiency
        INTEGER
        NOT NULL,

    importance_weight_pct
        NUMERIC(7, 2)
        NOT NULL,

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

    CONSTRAINT fk_work_capability_skill
        FOREIGN KEY (
            skill_id
        )
        REFERENCES procurement_capability_skills (id),

    CONSTRAINT fk_work_capability_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_work_capability_requirement
        UNIQUE (
            currency,
            fiscal_year,
            source_type,
            source_entity_id,
            skill_id
        ),

    CONSTRAINT ck_work_capability_source_type
        CHECK (
            source_type IN (
                'CATEGORY_INITIATIVE',
                'IMPROVEMENT_INITIATIVE',
                'EXECUTION_PORTFOLIO',
                'RISK_ESCALATION'
            )
        ),

    CONSTRAINT ck_work_capability_proficiency
        CHECK (
            required_proficiency
                BETWEEN 1 AND 5
        ),

    CONSTRAINT ck_work_capability_weight
        CHECK (
            importance_weight_pct > 0
            AND importance_weight_pct <= 100
        )
);

CREATE TABLE procurement_capability_development_actions (
    id UUID PRIMARY KEY,

    user_id
        UUID
        NOT NULL,

    skill_id
        UUID
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    action_type
        VARCHAR(30)
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    description
        VARCHAR(3000),

    target_proficiency
        INTEGER
        NOT NULL,

    due_date
        DATE
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    evidence_note
        VARCHAR(3000),

    created_by_user_id
        UUID
        NOT NULL,

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

    CONSTRAINT fk_capability_action_user
        FOREIGN KEY (
            user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_capability_action_skill
        FOREIGN KEY (
            skill_id
        )
        REFERENCES procurement_capability_skills (id),

    CONSTRAINT fk_capability_action_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capability_action_type
        CHECK (
            action_type IN (
                'TRAINING',
                'COACHING',
                'SHADOWING',
                'SELF_STUDY',
                'CERTIFICATION'
            )
        ),

    CONSTRAINT ck_capability_action_target
        CHECK (
            target_proficiency
                BETWEEN 1 AND 5
        ),

    CONSTRAINT ck_capability_action_status
        CHECK (
            status IN (
                'PLANNED',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        )
);

CREATE TABLE procurement_capability_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number
        VARCHAR(50)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    active_skill_count
        INTEGER
        NOT NULL,

    assessed_member_count
        INTEGER
        NOT NULL,

    strategic_work_count
        INTEGER
        NOT NULL,

    work_with_requirements_count
        INTEGER
        NOT NULL,

    ready_work_count
        INTEGER
        NOT NULL,

    watch_work_count
        INTEGER
        NOT NULL,

    gap_work_count
        INTEGER
        NOT NULL,

    critical_work_count
        INTEGER
        NOT NULL,

    critical_gap_count
        INTEGER
        NOT NULL,

    open_development_action_count
        INTEGER
        NOT NULL,

    requirement_coverage_pct
        NUMERIC(7, 2)
        NOT NULL,

    average_assigned_fit_pct
        NUMERIC(7, 2)
        NOT NULL,

    average_bench_fit_pct
        NUMERIC(7, 2)
        NOT NULL,

    capability_score
        NUMERIC(7, 2)
        NOT NULL,

    capability_health
        VARCHAR(20)
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_capability_snapshot_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_capability_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capability_snapshot_health
        CHECK (
            capability_health IN (
                'UNDEFINED',
                'READY',
                'WATCH',
                'GAP',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_capability_snapshot_pct
        CHECK (
            requirement_coverage_pct BETWEEN 0 AND 100
            AND average_assigned_fit_pct BETWEEN 0 AND 100
            AND average_bench_fit_pct BETWEEN 0 AND 100
            AND capability_score BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_capability_snapshot_members (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    user_id
        UUID
        NOT NULL,

    user_name
        VARCHAR(300)
        NOT NULL,

    role
        VARCHAR(80)
        NOT NULL,

    assessed_skill_count
        INTEGER
        NOT NULL,

    average_proficiency
        NUMERIC(7, 2)
        NOT NULL,

    assigned_work_item_count
        INTEGER
        NOT NULL,

    capability_gap_count
        INTEGER
        NOT NULL,

    open_development_action_count
        INTEGER
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_capability_snapshot_member
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_capability_snapshots (id)
        ON DELETE CASCADE
);

CREATE TABLE procurement_capability_snapshot_work_items (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    source_type
        VARCHAR(40)
        NOT NULL,

    source_entity_id
        UUID
        NOT NULL,

    source_reference
        VARCHAR(180)
        NOT NULL,

    source_title
        VARCHAR(500)
        NOT NULL,

    source_status
        VARCHAR(80)
        NOT NULL,

    assigned_member_count
        INTEGER
        NOT NULL,

    requirement_count
        INTEGER
        NOT NULL,

    critical_gap_count
        INTEGER
        NOT NULL,

    assigned_fit_pct
        NUMERIC(7, 2)
        NOT NULL,

    bench_fit_pct
        NUMERIC(7, 2)
        NOT NULL,

    bench_ready_member_count
        INTEGER
        NOT NULL,

    readiness
        VARCHAR(20)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_capability_snapshot_work
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_capability_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_capability_snapshot_work_readiness
        CHECK (
            readiness IN (
                'UNDEFINED',
                'READY',
                'WATCH',
                'GAP',
                'CRITICAL'
            )
        )
);

CREATE INDEX idx_capability_skill_active
    ON procurement_capability_skills (
        active,
        category,
        name
    );

CREATE INDEX idx_user_capability_user
    ON procurement_user_capabilities (
        user_id,
        skill_id
    );

CREATE INDEX idx_work_capability_scope
    ON procurement_work_capability_requirements (
        currency,
        fiscal_year,
        source_type,
        source_entity_id
    );

CREATE INDEX idx_capability_action_scope
    ON procurement_capability_development_actions (
        fiscal_year,
        user_id,
        status,
        due_date
    );

CREATE INDEX idx_capability_snapshot_scope
    ON procurement_capability_snapshots (
        currency,
        fiscal_year,
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_capability_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement capability snapshots are immutable';
END;
$$;

CREATE TRIGGER trg_capability_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_capability_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capability_snapshot_mutation();

CREATE TRIGGER trg_capability_snapshot_member_immutable
BEFORE UPDATE OR DELETE
ON procurement_capability_snapshot_members
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capability_snapshot_mutation();

CREATE TRIGGER trg_capability_snapshot_work_immutable
BEFORE UPDATE OR DELETE
ON procurement_capability_snapshot_work_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capability_snapshot_mutation();

CREATE TRIGGER trg_audit_capability_skills
AFTER INSERT OR UPDATE OR DELETE
ON procurement_capability_skills
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_user_capabilities
AFTER INSERT OR UPDATE OR DELETE
ON procurement_user_capabilities
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_work_capability_requirements
AFTER INSERT OR UPDATE OR DELETE
ON procurement_work_capability_requirements
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capability_development_actions
AFTER INSERT OR UPDATE OR DELETE
ON procurement_capability_development_actions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capability_snapshots
AFTER INSERT
ON procurement_capability_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
