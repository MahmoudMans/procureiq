CREATE TABLE supplier_resilience_profiles (
    id UUID PRIMARY KEY,

    supplier_id
        UUID
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    criticality
        VARCHAR(30)
        NOT NULL,

    capacity_status
        VARCHAR(30)
        NOT NULL,

    dependency_tolerance_pct
        NUMERIC(5, 2)
        NOT NULL,

    minimum_alternates
        INTEGER
        NOT NULL,

    business_impact
        VARCHAR(2000),

    capacity_notes
        VARCHAR(2000),

    notes
        VARCHAR(3000),

    owner_user_id
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

    CONSTRAINT uk_supplier_resilience_supplier
        UNIQUE (
            supplier_id
        ),

    CONSTRAINT fk_supplier_resilience_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_supplier_resilience_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_supplier_resilience_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE'
            )
        ),

    CONSTRAINT ck_supplier_resilience_criticality
        CHECK (
            criticality IN (
                'STANDARD',
                'CRITICAL',
                'STRATEGIC'
            )
        ),

    CONSTRAINT ck_supplier_capacity_status
        CHECK (
            capacity_status IN (
                'UNKNOWN',
                'ADEQUATE',
                'CONSTRAINED',
                'AT_RISK'
            )
        ),

    CONSTRAINT ck_supplier_dependency_tolerance
        CHECK (
            dependency_tolerance_pct
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_supplier_minimum_alternates
        CHECK (
            minimum_alternates
                BETWEEN 0 AND 20
        )
);

CREATE TABLE supplier_resilience_actions (
    id UUID PRIMARY KEY,

    profile_id
        UUID
        NOT NULL,

    action_type
        VARCHAR(50)
        NOT NULL,

    title
        VARCHAR(220)
        NOT NULL,

    description
        VARCHAR(2000),

    owner_user_id
        UUID
        NOT NULL,

    due_date
        DATE
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    completion_note
        VARCHAR(2000),

    completed_at
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

    CONSTRAINT fk_resilience_action_profile
        FOREIGN KEY (
            profile_id
        )
        REFERENCES supplier_resilience_profiles (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_resilience_action_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_resilience_action_type
        CHECK (
            action_type IN (
                'QUALIFY_ALTERNATE',
                'REDUCE_DEPENDENCY',
                'CONTRACT_COVERAGE',
                'CAPACITY_REVIEW',
                'GEOGRAPHIC_DIVERSIFICATION',
                'PERFORMANCE_IMPROVEMENT',
                'OTHER'
            )
        ),

    CONSTRAINT ck_resilience_action_status
        CHECK (
            status IN (
                'OPEN',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        )
);

CREATE INDEX idx_supplier_resilience_status
    ON supplier_resilience_profiles (
        status,
        criticality
    );

CREATE INDEX idx_supplier_resilience_capacity
    ON supplier_resilience_profiles (
        capacity_status,
        status
    );

CREATE INDEX idx_resilience_action_profile
    ON supplier_resilience_actions (
        profile_id,
        status
    );

CREATE INDEX idx_resilience_action_due
    ON supplier_resilience_actions (
        due_date,
        status
    );

CREATE INDEX idx_resilience_action_owner
    ON supplier_resilience_actions (
        owner_user_id,
        status
    );

CREATE TRIGGER trg_audit_supplier_resilience_profiles
AFTER INSERT OR UPDATE OR DELETE
ON supplier_resilience_profiles
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_supplier_resilience_actions
AFTER INSERT OR UPDATE OR DELETE
ON supplier_resilience_actions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
