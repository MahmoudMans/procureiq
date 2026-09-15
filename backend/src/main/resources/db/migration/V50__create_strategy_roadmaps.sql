CREATE SEQUENCE procurement_strategy_roadmap_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_strategy_roadmap_initiative_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_strategy_roadmap_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_strategy_roadmaps (
    id UUID PRIMARY KEY,

    roadmap_number
        VARCHAR(60)
        NOT NULL,

    source_scenario_id
        UUID
        NOT NULL,

    source_scenario_number
        VARCHAR(60)
        NOT NULL,

    source_scenario_name
        VARCHAR(300)
        NOT NULL,

    source_evaluation_id
        UUID
        NOT NULL,

    source_evaluation_number
        VARCHAR(60)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    objective
        VARCHAR(4000)
        NOT NULL,

    start_date
        DATE
        NOT NULL,

    target_end_date
        DATE
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    scenario_baseline_score
        NUMERIC(7, 2)
        NOT NULL,

    scenario_simulated_score
        NUMERIC(7, 2)
        NOT NULL,

    scenario_delta
        NUMERIC(9, 2)
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

    activated_at
        TIMESTAMPTZ,

    completed_at
        TIMESTAMPTZ,

    archived_at
        TIMESTAMPTZ,

    version
        BIGINT
        NOT NULL
        DEFAULT 0,

    CONSTRAINT uk_strategy_roadmap_number
        UNIQUE (
            roadmap_number
        ),

    CONSTRAINT uk_strategy_roadmap_scenario
        UNIQUE (
            source_scenario_id
        ),

    CONSTRAINT fk_strategy_roadmap_scenario
        FOREIGN KEY (
            source_scenario_id
        )
        REFERENCES procurement_strategy_scenarios (id),

    CONSTRAINT fk_strategy_roadmap_evaluation
        FOREIGN KEY (
            source_evaluation_id
        )
        REFERENCES procurement_strategy_scenario_evaluations (id),

    CONSTRAINT fk_strategy_roadmap_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategy_roadmap_status
        CHECK (
            status IN (
                'DRAFT',
                'ACTIVE',
                'ON_HOLD',
                'COMPLETED',
                'ARCHIVED'
            )
        ),

    CONSTRAINT ck_strategy_roadmap_dates
        CHECK (
            target_end_date >= start_date
        ),

    CONSTRAINT ck_strategy_roadmap_scores
        CHECK (
            scenario_baseline_score BETWEEN 0 AND 100
            AND scenario_simulated_score BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_strategy_roadmap_initiatives (
    id UUID PRIMARY KEY,

    roadmap_id
        UUID
        NOT NULL,

    initiative_number
        VARCHAR(60)
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    description
        VARCHAR(4000),

    dimension_key
        VARCHAR(50)
        NOT NULL,

    priority
        VARCHAR(20)
        NOT NULL,

    owner_user_id
        UUID
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

    created_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    started_at
        TIMESTAMPTZ,

    completed_at
        TIMESTAMPTZ,

    cancelled_at
        TIMESTAMPTZ,

    version
        BIGINT
        NOT NULL
        DEFAULT 0,

    CONSTRAINT uk_strategy_roadmap_initiative_number
        UNIQUE (
            initiative_number
        ),

    CONSTRAINT fk_strategy_roadmap_initiative_roadmap
        FOREIGN KEY (
            roadmap_id
        )
        REFERENCES procurement_strategy_roadmaps (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_strategy_roadmap_initiative_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_strategy_roadmap_initiative_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategy_roadmap_initiative_dimension
        CHECK (
            dimension_key IN (
                'OBJECTIVE_EXECUTION',
                'STRATEGIC_ALIGNMENT',
                'CAPACITY_READINESS',
                'CAPABILITY_READINESS',
                'SUCCESSION_RESILIENCE'
            )
        ),

    CONSTRAINT ck_strategy_roadmap_initiative_priority
        CHECK (
            priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_strategy_roadmap_initiative_status
        CHECK (
            status IN (
                'PLANNED',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_strategy_roadmap_initiative_dates
        CHECK (
            planned_end_date >= planned_start_date
        ),

    CONSTRAINT ck_strategy_roadmap_initiative_contribution
        CHECK (
            planned_contribution_points
                BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_strategy_roadmap_dependencies (
    id UUID PRIMARY KEY,

    roadmap_id
        UUID
        NOT NULL,

    predecessor_initiative_id
        UUID
        NOT NULL,

    successor_initiative_id
        UUID
        NOT NULL,

    dependency_type
        VARCHAR(30)
        NOT NULL,

    rationale
        VARCHAR(3000),

    created_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_strategy_roadmap_dependency_roadmap
        FOREIGN KEY (
            roadmap_id
        )
        REFERENCES procurement_strategy_roadmaps (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_strategy_roadmap_dependency_predecessor
        FOREIGN KEY (
            predecessor_initiative_id
        )
        REFERENCES procurement_strategy_roadmap_initiatives (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_strategy_roadmap_dependency_successor
        FOREIGN KEY (
            successor_initiative_id
        )
        REFERENCES procurement_strategy_roadmap_initiatives (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_strategy_roadmap_dependency_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_strategy_roadmap_dependency
        UNIQUE (
            predecessor_initiative_id,
            successor_initiative_id
        ),

    CONSTRAINT ck_strategy_roadmap_dependency_type
        CHECK (
            dependency_type IN (
                'FINISH_TO_START',
                'START_TO_START',
                'FINISH_TO_FINISH'
            )
        ),

    CONSTRAINT ck_strategy_roadmap_dependency_distinct
        CHECK (
            predecessor_initiative_id
                <> successor_initiative_id
        )
);

CREATE TABLE procurement_strategy_roadmap_milestones (
    id UUID PRIMARY KEY,

    initiative_id
        UUID
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    description
        VARCHAR(3000),

    due_date
        DATE
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    created_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    completed_at
        TIMESTAMPTZ,

    cancelled_at
        TIMESTAMPTZ,

    CONSTRAINT fk_strategy_roadmap_milestone_initiative
        FOREIGN KEY (
            initiative_id
        )
        REFERENCES procurement_strategy_roadmap_initiatives (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_strategy_roadmap_milestone_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategy_roadmap_milestone_status
        CHECK (
            status IN (
                'PLANNED',
                'COMPLETED',
                'CANCELLED'
            )
        )
);

CREATE TABLE procurement_strategy_roadmap_gates (
    id UUID PRIMARY KEY,

    initiative_id
        UUID
        NOT NULL,

    gate_name
        VARCHAR(300)
        NOT NULL,

    due_date
        DATE
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    decision_note
        VARCHAR(3000),

    created_by_user_id
        UUID
        NOT NULL,

    decided_by_user_id
        UUID,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    decided_at
        TIMESTAMPTZ,

    CONSTRAINT fk_strategy_roadmap_gate_initiative
        FOREIGN KEY (
            initiative_id
        )
        REFERENCES procurement_strategy_roadmap_initiatives (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_strategy_roadmap_gate_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_strategy_roadmap_gate_decider
        FOREIGN KEY (
            decided_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategy_roadmap_gate_status
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED',
                'WAIVED'
            )
        )
);

CREATE TABLE procurement_strategy_roadmap_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number
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

    roadmap_status
        VARCHAR(20)
        NOT NULL,

    initiative_count
        INTEGER
        NOT NULL,

    completed_initiative_count
        INTEGER
        NOT NULL,

    blocked_initiative_count
        INTEGER
        NOT NULL,

    overdue_milestone_count
        INTEGER
        NOT NULL,

    rejected_gate_count
        INTEGER
        NOT NULL,

    owner_coverage_pct
        NUMERIC(7, 2)
        NOT NULL,

    dependency_health_pct
        NUMERIC(7, 2)
        NOT NULL,

    milestone_health_pct
        NUMERIC(7, 2)
        NOT NULL,

    gate_health_pct
        NUMERIC(7, 2)
        NOT NULL,

    readiness_score
        NUMERIC(7, 2)
        NOT NULL,

    readiness_health
        VARCHAR(20)
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_strategy_roadmap_snapshot_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_strategy_roadmap_snapshot_roadmap
        FOREIGN KEY (
            roadmap_id
        )
        REFERENCES procurement_strategy_roadmaps (id),

    CONSTRAINT fk_strategy_roadmap_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategy_roadmap_snapshot_health
        CHECK (
            readiness_health IN (
                'UNDEFINED',
                'READY',
                'WATCH',
                'AT_RISK',
                'BLOCKED'
            )
        ),

    CONSTRAINT ck_strategy_roadmap_snapshot_scores
        CHECK (
            owner_coverage_pct BETWEEN 0 AND 100
            AND dependency_health_pct BETWEEN 0 AND 100
            AND milestone_health_pct BETWEEN 0 AND 100
            AND gate_health_pct BETWEEN 0 AND 100
            AND readiness_score BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_strategy_roadmap_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    initiative_id
        UUID
        NOT NULL,

    initiative_number
        VARCHAR(60)
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    dimension_key
        VARCHAR(50)
        NOT NULL,

    priority
        VARCHAR(20)
        NOT NULL,

    owner_name
        VARCHAR(300)
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

    blocked_dependency_count
        INTEGER
        NOT NULL,

    overdue_milestone_count
        INTEGER
        NOT NULL,

    pending_gate_count
        INTEGER
        NOT NULL,

    rejected_gate_count
        INTEGER
        NOT NULL,

    blocked
        BOOLEAN
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_strategy_roadmap_snapshot_item
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_strategy_roadmap_snapshots (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_strategy_roadmap_scope
    ON procurement_strategy_roadmaps (
        currency,
        fiscal_year,
        status,
        created_at DESC
    );

CREATE INDEX idx_strategy_roadmap_initiative_roadmap
    ON procurement_strategy_roadmap_initiatives (
        roadmap_id,
        status,
        priority
    );

CREATE INDEX idx_strategy_roadmap_dependency_roadmap
    ON procurement_strategy_roadmap_dependencies (
        roadmap_id,
        predecessor_initiative_id,
        successor_initiative_id
    );

CREATE INDEX idx_strategy_roadmap_milestone_initiative
    ON procurement_strategy_roadmap_milestones (
        initiative_id,
        status,
        due_date
    );

CREATE INDEX idx_strategy_roadmap_gate_initiative
    ON procurement_strategy_roadmap_gates (
        initiative_id,
        status,
        due_date
    );

CREATE INDEX idx_strategy_roadmap_snapshot_roadmap
    ON procurement_strategy_roadmap_snapshots (
        roadmap_id,
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_roadmap_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement strategy roadmap snapshots are immutable';
END;
$$;

CREATE TRIGGER trg_strategy_roadmap_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_strategy_roadmap_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_roadmap_snapshot_mutation();

CREATE TRIGGER trg_strategy_roadmap_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_strategy_roadmap_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_roadmap_snapshot_mutation();

CREATE TRIGGER trg_audit_strategy_roadmaps
AFTER INSERT OR UPDATE
ON procurement_strategy_roadmaps
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_strategy_roadmap_initiatives
AFTER INSERT OR UPDATE
ON procurement_strategy_roadmap_initiatives
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_strategy_roadmap_dependencies
AFTER INSERT OR DELETE
ON procurement_strategy_roadmap_dependencies
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_strategy_roadmap_milestones
AFTER INSERT OR UPDATE
ON procurement_strategy_roadmap_milestones
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_strategy_roadmap_gates
AFTER INSERT OR UPDATE
ON procurement_strategy_roadmap_gates
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_strategy_roadmap_snapshots
AFTER INSERT
ON procurement_strategy_roadmap_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
