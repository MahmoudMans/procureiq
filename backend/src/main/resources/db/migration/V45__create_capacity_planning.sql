CREATE SEQUENCE procurement_capacity_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_capacity_profiles (
    id UUID PRIMARY KEY,

    user_id
        UUID
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    annual_capacity_hours
        NUMERIC(12, 2)
        NOT NULL,

    reserved_operational_pct
        NUMERIC(7, 2)
        NOT NULL,

    notes
        VARCHAR(3000),

    created_by_user_id
        UUID
        NOT NULL,

    updated_by_user_id
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

    CONSTRAINT fk_capacity_profile_user
        FOREIGN KEY (
            user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_capacity_profile_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_capacity_profile_updater
        FOREIGN KEY (
            updated_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_capacity_profile_user_year
        UNIQUE (
            user_id,
            fiscal_year
        ),

    CONSTRAINT ck_capacity_profile_year
        CHECK (
            fiscal_year BETWEEN 2000 AND 2200
        ),

    CONSTRAINT ck_capacity_profile_hours
        CHECK (
            annual_capacity_hours >= 0
        ),

    CONSTRAINT ck_capacity_profile_reserved
        CHECK (
            reserved_operational_pct
                BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_capacity_work_estimates (
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

    due_date_snapshot
        DATE,

    strategic_value_snapshot
        NUMERIC(19, 2)
        NOT NULL,

    risk_exposure_snapshot
        NUMERIC(19, 2)
        NOT NULL,

    risk_score_snapshot
        NUMERIC(7, 2)
        NOT NULL,

    estimated_effort_hours
        NUMERIC(12, 2)
        NOT NULL,

    created_by_user_id
        UUID
        NOT NULL,

    updated_by_user_id
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

    CONSTRAINT fk_capacity_estimate_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_capacity_estimate_updater
        FOREIGN KEY (
            updated_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_capacity_estimate_source
        UNIQUE (
            currency,
            fiscal_year,
            source_type,
            source_entity_id
        ),

    CONSTRAINT ck_capacity_estimate_source_type
        CHECK (
            source_type IN (
                'CATEGORY_INITIATIVE',
                'IMPROVEMENT_INITIATIVE',
                'EXECUTION_PORTFOLIO',
                'RISK_ESCALATION'
            )
        ),

    CONSTRAINT ck_capacity_estimate_hours
        CHECK (
            estimated_effort_hours > 0
        )
);

CREATE TABLE procurement_capacity_assignments (
    id UUID PRIMARY KEY,

    work_estimate_id
        UUID
        NOT NULL,

    user_id
        UUID
        NOT NULL,

    allocation_pct
        NUMERIC(7, 2)
        NOT NULL,

    created_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_capacity_assignment_estimate
        FOREIGN KEY (
            work_estimate_id
        )
        REFERENCES procurement_capacity_work_estimates (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_capacity_assignment_user
        FOREIGN KEY (
            user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_capacity_assignment_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_capacity_assignment_user
        UNIQUE (
            work_estimate_id,
            user_id
        ),

    CONSTRAINT ck_capacity_assignment_pct
        CHECK (
            allocation_pct > 0
            AND allocation_pct <= 100
        )
);

CREATE TABLE procurement_capacity_snapshots (
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

    strategic_source_count
        INTEGER
        NOT NULL,

    estimated_source_count
        INTEGER
        NOT NULL,

    fully_assigned_source_count
        INTEGER
        NOT NULL,

    unassigned_source_count
        INTEGER
        NOT NULL,

    profile_count
        INTEGER
        NOT NULL,

    effective_capacity_hours
        NUMERIC(14, 2)
        NOT NULL,

    estimated_demand_hours
        NUMERIC(14, 2)
        NOT NULL,

    assigned_demand_hours
        NUMERIC(14, 2)
        NOT NULL,

    unassigned_demand_hours
        NUMERIC(14, 2)
        NOT NULL,

    capacity_gap_hours
        NUMERIC(14, 2)
        NOT NULL,

    estimation_coverage_pct
        NUMERIC(7, 2)
        NOT NULL,

    assignment_coverage_pct
        NUMERIC(7, 2)
        NOT NULL,

    capacity_coverage_pct
        NUMERIC(7, 2)
        NOT NULL,

    deadline_health_pct
        NUMERIC(7, 2)
        NOT NULL,

    capacity_score
        NUMERIC(7, 2)
        NOT NULL,

    portfolio_health
        VARCHAR(20)
        NOT NULL,

    overloaded_member_count
        INTEGER
        NOT NULL,

    critical_member_count
        INTEGER
        NOT NULL,

    deadline_pressure_count
        INTEGER
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_capacity_snapshot_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_capacity_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capacity_snapshot_health
        CHECK (
            portfolio_health IN (
                'HEALTHY',
                'TIGHT',
                'OVERLOADED',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_capacity_snapshot_percentages
        CHECK (
            estimation_coverage_pct BETWEEN 0 AND 100
            AND assignment_coverage_pct BETWEEN 0 AND 100
            AND capacity_coverage_pct BETWEEN 0 AND 100
            AND deadline_health_pct BETWEEN 0 AND 100
            AND capacity_score BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_capacity_snapshot_members (
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

    annual_capacity_hours
        NUMERIC(12, 2)
        NOT NULL,

    reserved_operational_pct
        NUMERIC(7, 2)
        NOT NULL,

    effective_capacity_hours
        NUMERIC(12, 2)
        NOT NULL,

    assigned_effort_hours
        NUMERIC(12, 2)
        NOT NULL,

    remaining_capacity_hours
        NUMERIC(12, 2)
        NOT NULL,

    utilization_pct
        NUMERIC(9, 2)
        NOT NULL,

    health
        VARCHAR(20)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_capacity_snapshot_member_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_capacity_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_capacity_snapshot_member_health
        CHECK (
            health IN (
                'HEALTHY',
                'TIGHT',
                'OVERLOADED',
                'CRITICAL'
            )
        )
);

CREATE TABLE procurement_capacity_snapshot_work_items (
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

    due_date
        DATE,

    strategic_value
        NUMERIC(19, 2)
        NOT NULL,

    risk_exposure
        NUMERIC(19, 2)
        NOT NULL,

    risk_score
        NUMERIC(7, 2)
        NOT NULL,

    estimated_effort_hours
        NUMERIC(12, 2)
        NOT NULL,

    assigned_effort_hours
        NUMERIC(12, 2)
        NOT NULL,

    unassigned_effort_hours
        NUMERIC(12, 2)
        NOT NULL,

    allocation_pct
        NUMERIC(7, 2)
        NOT NULL,

    assignment_count
        INTEGER
        NOT NULL,

    planning_status
        VARCHAR(20)
        NOT NULL,

    deadline_pressure
        BOOLEAN
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_capacity_snapshot_work_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_capacity_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_capacity_snapshot_work_status
        CHECK (
            planning_status IN (
                'UNESTIMATED',
                'UNASSIGNED',
                'PARTIAL',
                'FULL'
            )
        )
);

CREATE INDEX idx_capacity_profile_year
    ON procurement_capacity_profiles (
        fiscal_year,
        user_id
    );

CREATE INDEX idx_capacity_estimate_scope
    ON procurement_capacity_work_estimates (
        currency,
        fiscal_year,
        source_type
    );

CREATE INDEX idx_capacity_assignment_estimate
    ON procurement_capacity_assignments (
        work_estimate_id
    );

CREATE INDEX idx_capacity_snapshot_scope
    ON procurement_capacity_snapshots (
        currency,
        fiscal_year,
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_capacity_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement capacity snapshots are immutable';
END;
$$;

CREATE TRIGGER trg_capacity_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_capacity_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capacity_snapshot_mutation();

CREATE TRIGGER trg_capacity_snapshot_member_immutable
BEFORE UPDATE OR DELETE
ON procurement_capacity_snapshot_members
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capacity_snapshot_mutation();

CREATE TRIGGER trg_capacity_snapshot_work_immutable
BEFORE UPDATE OR DELETE
ON procurement_capacity_snapshot_work_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capacity_snapshot_mutation();

CREATE TRIGGER trg_audit_capacity_profiles
AFTER INSERT OR UPDATE OR DELETE
ON procurement_capacity_profiles
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capacity_estimates
AFTER INSERT OR UPDATE OR DELETE
ON procurement_capacity_work_estimates
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capacity_assignments
AFTER INSERT OR DELETE
ON procurement_capacity_assignments
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capacity_snapshots
AFTER INSERT
ON procurement_capacity_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
