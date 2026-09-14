CREATE TABLE procurement_control_tower_runs (
    id UUID PRIMARY KEY,

    currency
        VARCHAR(3)
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    started_by_user_id
        UUID
        NOT NULL,

    discovered_count
        INTEGER
        NOT NULL
        DEFAULT 0,

    refreshed_count
        INTEGER
        NOT NULL
        DEFAULT 0,

    auto_resolved_count
        INTEGER
        NOT NULL
        DEFAULT 0,

    started_at
        TIMESTAMPTZ
        NOT NULL,

    completed_at
        TIMESTAMPTZ,

    CONSTRAINT fk_control_tower_run_user
        FOREIGN KEY (
            started_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_control_tower_run_status
        CHECK (
            status IN (
                'RUNNING',
                'COMPLETED'
            )
        )
);

CREATE TABLE procurement_control_tower_items (
    id UUID PRIMARY KEY,

    exception_key
        VARCHAR(400)
        NOT NULL,

    exception_type
        VARCHAR(50)
        NOT NULL,

    source_entity_type
        VARCHAR(60)
        NOT NULL,

    source_entity_id
        UUID
        NOT NULL,

    source_reference
        VARCHAR(180)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    details
        VARCHAR(3000)
        NOT NULL,

    severity
        VARCHAR(20)
        NOT NULL,

    priority_score
        NUMERIC(6, 2)
        NOT NULL,

    monetary_exposure
        NUMERIC(19, 2)
        NOT NULL,

    source_due_date
        DATE,

    sla_due_at
        TIMESTAMPTZ
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    owner_user_id
        UUID,

    acknowledged_by_user_id
        UUID,

    acknowledgement_note
        VARCHAR(2000),

    acknowledged_at
        TIMESTAMPTZ,

    started_at
        TIMESTAMPTZ,

    resolution_note
        VARCHAR(2500),

    resolved_by_user_id
        UUID,

    resolved_at
        TIMESTAMPTZ,

    first_seen_at
        TIMESTAMPTZ
        NOT NULL,

    last_seen_at
        TIMESTAMPTZ
        NOT NULL,

    last_scan_id
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

    CONSTRAINT uk_control_tower_exception_key
        UNIQUE (
            exception_key
        ),

    CONSTRAINT fk_control_tower_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_control_tower_ack_user
        FOREIGN KEY (
            acknowledged_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_control_tower_resolved_user
        FOREIGN KEY (
            resolved_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_control_tower_last_scan
        FOREIGN KEY (
            last_scan_id
        )
        REFERENCES procurement_control_tower_runs (id),

    CONSTRAINT ck_control_tower_exception_type
        CHECK (
            exception_type IN (
                'SUPPLIER_RISK_ALERT',
                'RISK_ESCALATION_OVERDUE',
                'DOCUMENT_COMPLIANCE_GAP',
                'SOURCING_INITIATIVE_OVERDUE',
                'BENEFIT_VALIDATION_PENDING',
                'BENEFIT_LEAKAGE',
                'GOVERNANCE_DECISION_OVERDUE',
                'GOVERNANCE_ACTION_OVERDUE',
                'COMMERCIAL_LEAKAGE'
            )
        ),

    CONSTRAINT ck_control_tower_severity
        CHECK (
            severity IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_control_tower_priority
        CHECK (
            priority_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_control_tower_exposure
        CHECK (
            monetary_exposure >= 0
        ),

    CONSTRAINT ck_control_tower_status
        CHECK (
            status IN (
                'OPEN',
                'ACKNOWLEDGED',
                'IN_PROGRESS',
                'RESOLVED',
                'DISMISSED'
            )
        )
);

CREATE INDEX idx_control_tower_active_queue
    ON procurement_control_tower_items (
        currency,
        status,
        priority_score DESC,
        sla_due_at
    );

CREATE INDEX idx_control_tower_type
    ON procurement_control_tower_items (
        currency,
        exception_type,
        status
    );

CREATE INDEX idx_control_tower_owner
    ON procurement_control_tower_items (
        owner_user_id,
        status,
        sla_due_at
    );

CREATE INDEX idx_control_tower_scan
    ON procurement_control_tower_items (
        last_scan_id
    );

CREATE INDEX idx_control_tower_source
    ON procurement_control_tower_items (
        source_entity_type,
        source_entity_id
    );

CREATE INDEX idx_control_tower_runs_currency
    ON procurement_control_tower_runs (
        currency,
        started_at DESC
    );

CREATE TRIGGER trg_audit_procurement_control_tower_items
AFTER INSERT OR UPDATE OR DELETE
ON procurement_control_tower_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
