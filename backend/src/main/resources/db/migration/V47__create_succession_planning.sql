CREATE SEQUENCE procurement_succession_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_critical_capability_policies (
    id UUID PRIMARY KEY,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    skill_id
        UUID
        NOT NULL,

    criticality
        VARCHAR(20)
        NOT NULL,

    required_proficiency
        INTEGER
        NOT NULL,

    target_ready_people
        INTEGER
        NOT NULL,

    notes
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

    CONSTRAINT fk_critical_capability_skill
        FOREIGN KEY (
            skill_id
        )
        REFERENCES procurement_capability_skills (id),

    CONSTRAINT fk_critical_capability_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_critical_capability_policy
        UNIQUE (
            currency,
            fiscal_year,
            skill_id
        ),

    CONSTRAINT ck_critical_capability_year
        CHECK (
            fiscal_year BETWEEN 2000 AND 2200
        ),

    CONSTRAINT ck_critical_capability_criticality
        CHECK (
            criticality IN (
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_critical_capability_proficiency
        CHECK (
            required_proficiency
                BETWEEN 1 AND 5
        ),

    CONSTRAINT ck_critical_capability_ready_people
        CHECK (
            target_ready_people
                BETWEEN 1 AND 20
        )
);

CREATE TABLE procurement_succession_candidates (
    id UUID PRIMARY KEY,

    policy_id
        UUID
        NOT NULL,

    user_id
        UUID
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    rationale
        VARCHAR(3000)
        NOT NULL,

    target_date
        DATE,

    nominated_by_user_id
        UUID
        NOT NULL,

    nominated_at
        TIMESTAMPTZ
        NOT NULL,

    developing_at
        TIMESTAMPTZ,

    ready_at
        TIMESTAMPTZ,

    declined_at
        TIMESTAMPTZ,

    decision_note
        VARCHAR(3000),

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    version
        BIGINT
        NOT NULL
        DEFAULT 0,

    CONSTRAINT fk_succession_candidate_policy
        FOREIGN KEY (
            policy_id
        )
        REFERENCES procurement_critical_capability_policies (id),

    CONSTRAINT fk_succession_candidate_user
        FOREIGN KEY (
            user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_succession_candidate_nominator
        FOREIGN KEY (
            nominated_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_succession_candidate
        UNIQUE (
            policy_id,
            user_id
        ),

    CONSTRAINT ck_succession_candidate_status
        CHECK (
            status IN (
                'IDENTIFIED',
                'DEVELOPING',
                'READY',
                'DECLINED'
            )
        )
);

CREATE TABLE procurement_succession_snapshots (
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

    policy_count
        INTEGER
        NOT NULL,

    covered_policy_count
        INTEGER
        NOT NULL,

    exposed_policy_count
        INTEGER
        NOT NULL,

    critical_exposure_count
        INTEGER
        NOT NULL,

    single_point_failure_count
        INTEGER
        NOT NULL,

    nominated_candidate_count
        INTEGER
        NOT NULL,

    ready_candidate_count
        INTEGER
        NOT NULL,

    average_ready_people
        NUMERIC(9, 2)
        NOT NULL,

    policy_coverage_pct
        NUMERIC(7, 2)
        NOT NULL,

    average_policy_score
        NUMERIC(7, 2)
        NOT NULL,

    succession_score
        NUMERIC(7, 2)
        NOT NULL,

    succession_health
        VARCHAR(20)
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_succession_snapshot_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_succession_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_succession_snapshot_health
        CHECK (
            succession_health IN (
                'UNDEFINED',
                'RESILIENT',
                'STABLE',
                'WATCH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_succession_snapshot_pct
        CHECK (
            policy_coverage_pct BETWEEN 0 AND 100
            AND average_policy_score BETWEEN 0 AND 100
            AND succession_score BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_succession_snapshot_policies (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    policy_id
        UUID
        NOT NULL,

    skill_id
        UUID
        NOT NULL,

    skill_code
        VARCHAR(80)
        NOT NULL,

    skill_name
        VARCHAR(220)
        NOT NULL,

    skill_category
        VARCHAR(120)
        NOT NULL,

    criticality
        VARCHAR(20)
        NOT NULL,

    required_proficiency
        INTEGER
        NOT NULL,

    target_ready_people
        INTEGER
        NOT NULL,

    strategic_work_count
        INTEGER
        NOT NULL,

    assigned_member_count
        INTEGER
        NOT NULL,

    ready_people_count
        INTEGER
        NOT NULL,

    ready_bench_count
        INTEGER
        NOT NULL,

    nominated_candidate_count
        INTEGER
        NOT NULL,

    ready_candidate_count
        INTEGER
        NOT NULL,

    single_point_failure
        BOOLEAN
        NOT NULL,

    coverage_pct
        NUMERIC(7, 2)
        NOT NULL,

    policy_score
        NUMERIC(7, 2)
        NOT NULL,

    health
        VARCHAR(20)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_succession_snapshot_policy_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_succession_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_succession_snapshot_policy_health
        CHECK (
            health IN (
                'UNDEFINED',
                'RESILIENT',
                'STABLE',
                'WATCH',
                'CRITICAL'
            )
        )
);

CREATE TABLE procurement_succession_snapshot_candidates (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    policy_id
        UUID
        NOT NULL,

    candidate_id
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

    candidate_status
        VARCHAR(30)
        NOT NULL,

    current_proficiency
        INTEGER
        NOT NULL,

    proficiency_fit_pct
        NUMERIC(7, 2)
        NOT NULL,

    capacity_utilization_pct
        NUMERIC(9, 2)
        NOT NULL,

    evidence_score
        NUMERIC(7, 2)
        NOT NULL,

    readiness
        VARCHAR(20)
        NOT NULL,

    open_development_action_count
        INTEGER
        NOT NULL,

    target_date
        DATE,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_succession_snapshot_candidate_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_succession_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_succession_snapshot_candidate_readiness
        CHECK (
            readiness IN (
                'READY',
                'NEAR_READY',
                'DEVELOPING',
                'GAP'
            )
        )
);

CREATE INDEX idx_critical_capability_scope
    ON procurement_critical_capability_policies (
        currency,
        fiscal_year,
        active
    );

CREATE INDEX idx_succession_candidate_policy
    ON procurement_succession_candidates (
        policy_id,
        status
    );

CREATE INDEX idx_succession_snapshot_scope
    ON procurement_succession_snapshots (
        currency,
        fiscal_year,
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_succession_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement succession snapshots are immutable';
END;
$$;

CREATE TRIGGER trg_succession_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_succession_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_succession_snapshot_mutation();

CREATE TRIGGER trg_succession_snapshot_policy_immutable
BEFORE UPDATE OR DELETE
ON procurement_succession_snapshot_policies
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_succession_snapshot_mutation();

CREATE TRIGGER trg_succession_snapshot_candidate_immutable
BEFORE UPDATE OR DELETE
ON procurement_succession_snapshot_candidates
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_succession_snapshot_mutation();

CREATE TRIGGER trg_audit_critical_capability_policies
AFTER INSERT OR UPDATE
ON procurement_critical_capability_policies
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_succession_candidates
AFTER INSERT OR UPDATE
ON procurement_succession_candidates
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_succession_snapshots
AFTER INSERT
ON procurement_succession_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
