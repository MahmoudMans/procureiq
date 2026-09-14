CREATE SEQUENCE procurement_risk_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_risk_cases (
    id UUID PRIMARY KEY,

    risk_number
        VARCHAR(40)
        NOT NULL,

    source_key
        VARCHAR(255),

    origin
        VARCHAR(30)
        NOT NULL,

    category
        VARCHAR(40)
        NOT NULL,

    severity
        VARCHAR(30)
        NOT NULL,

    status
        VARCHAR(40)
        NOT NULL,

    title
        VARCHAR(220)
        NOT NULL,

    description
        VARCHAR(3000)
        NOT NULL,

    likelihood
        INTEGER
        NOT NULL,

    impact
        INTEGER
        NOT NULL,

    risk_score
        INTEGER
        NOT NULL,

    due_date
        DATE,

    supplier_id
        UUID,

    contract_id
        UUID,

    purchase_order_id
        UUID,

    rfq_id
        UUID,

    owner_user_id
        UUID
        NOT NULL,

    created_by_user_id
        UUID
        NOT NULL,

    escalated
        BOOLEAN
        NOT NULL,

    escalated_at
        TIMESTAMPTZ,

    escalated_by_user_id
        UUID,

    resolution_note
        VARCHAR(3000),

    resolved_at
        TIMESTAMPTZ,

    resolved_by_user_id
        UUID,

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

    CONSTRAINT uk_procurement_risk_number
        UNIQUE (
            risk_number
        ),

    CONSTRAINT uk_procurement_risk_source
        UNIQUE (
            source_key
        ),

    CONSTRAINT fk_procurement_risk_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id),

    CONSTRAINT fk_procurement_risk_contract
        FOREIGN KEY (
            contract_id
        )
        REFERENCES supplier_contracts (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_procurement_risk_po
        FOREIGN KEY (
            purchase_order_id
        )
        REFERENCES purchase_orders (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_procurement_risk_rfq
        FOREIGN KEY (
            rfq_id
        )
        REFERENCES rfqs (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_procurement_risk_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_procurement_risk_created_by
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_procurement_risk_escalated_by
        FOREIGN KEY (
            escalated_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_procurement_risk_resolved_by
        FOREIGN KEY (
            resolved_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_procurement_risk_origin
        CHECK (
            origin IN (
                'MANUAL',
                'SYSTEM'
            )
        ),

    CONSTRAINT ck_procurement_risk_category
        CHECK (
            category IN (
                'SUPPLIER',
                'CONTRACT',
                'PURCHASE_ORDER',
                'DELIVERY',
                'SOURCING',
                'COMPLIANCE',
                'OTHER'
            )
        ),

    CONSTRAINT ck_procurement_risk_severity
        CHECK (
            severity IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_procurement_risk_status
        CHECK (
            status IN (
                'OPEN',
                'IN_MITIGATION',
                'RESOLVED',
                'ACCEPTED'
            )
        ),

    CONSTRAINT ck_procurement_risk_likelihood
        CHECK (
            likelihood BETWEEN 1 AND 5
        ),

    CONSTRAINT ck_procurement_risk_impact
        CHECK (
            impact BETWEEN 1 AND 5
        ),

    CONSTRAINT ck_procurement_risk_score
        CHECK (
            risk_score BETWEEN 1 AND 25
        )
);

CREATE TABLE risk_mitigation_actions (
    id UUID PRIMARY KEY,

    risk_case_id
        UUID
        NOT NULL,

    title
        VARCHAR(220)
        NOT NULL,

    description
        VARCHAR(2000),

    status
        VARCHAR(30)
        NOT NULL,

    due_date
        DATE,

    owner_user_id
        UUID
        NOT NULL,

    created_by_user_id
        UUID
        NOT NULL,

    completed_at
        TIMESTAMPTZ,

    completed_by_user_id
        UUID,

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

    CONSTRAINT fk_mitigation_risk
        FOREIGN KEY (
            risk_case_id
        )
        REFERENCES procurement_risk_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_mitigation_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_mitigation_created_by
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_mitigation_completed_by
        FOREIGN KEY (
            completed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_mitigation_status
        CHECK (
            status IN (
                'OPEN',
                'COMPLETED',
                'CANCELLED'
            )
        )
);

CREATE INDEX idx_procurement_risk_status
    ON procurement_risk_cases (
        status,
        severity
    );

CREATE INDEX idx_procurement_risk_owner
    ON procurement_risk_cases (
        owner_user_id,
        status
    );

CREATE INDEX idx_procurement_risk_supplier
    ON procurement_risk_cases (
        supplier_id,
        status
    );

CREATE INDEX idx_procurement_risk_due
    ON procurement_risk_cases (
        due_date
    );

CREATE INDEX idx_procurement_risk_updated
    ON procurement_risk_cases (
        updated_at DESC
    );

CREATE INDEX idx_risk_mitigation_case
    ON risk_mitigation_actions (
        risk_case_id,
        status
    );

CREATE INDEX idx_risk_mitigation_owner
    ON risk_mitigation_actions (
        owner_user_id,
        status
    );

CREATE TRIGGER trg_audit_procurement_risk_cases
AFTER INSERT OR UPDATE OR DELETE
ON procurement_risk_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_risk_mitigation_actions
AFTER INSERT OR UPDATE OR DELETE
ON risk_mitigation_actions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
