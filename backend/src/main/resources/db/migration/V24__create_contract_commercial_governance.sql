CREATE TABLE contract_commercial_governance (
    id UUID PRIMARY KEY,

    contract_id
        UUID
        NOT NULL,

    supplier_id
        UUID
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    renewal_status
        VARCHAR(30)
        NOT NULL,

    contract_end_date_snapshot
        DATE
        NOT NULL,

    notice_period_days
        INTEGER
        NOT NULL,

    notice_deadline
        DATE
        NOT NULL,

    baseline_contract_value
        NUMERIC(19, 2)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    price_escalation_pct
        NUMERIC(9, 4)
        NOT NULL,

    max_po_variance_pct
        NUMERIC(9, 4)
        NOT NULL,

    auto_renewal
        BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    owner_user_id
        UUID
        NOT NULL,

    renewal_decision_note
        VARCHAR(2000),

    renewal_decided_by_user_id
        UUID,

    renewal_decided_at
        TIMESTAMPTZ,

    notes
        VARCHAR(3000),

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

    CONSTRAINT uk_contract_commercial_governance_contract
        UNIQUE (
            contract_id
        ),

    CONSTRAINT fk_commercial_governance_contract
        FOREIGN KEY (
            contract_id
        )
        REFERENCES supplier_contracts (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_commercial_governance_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id),

    CONSTRAINT fk_commercial_governance_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_commercial_governance_decider
        FOREIGN KEY (
            renewal_decided_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_commercial_governance_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE'
            )
        ),

    CONSTRAINT ck_commercial_renewal_status
        CHECK (
            renewal_status IN (
                'UPCOMING',
                'UNDER_REVIEW',
                'RENEW',
                'RENEGOTIATE',
                'TERMINATE',
                'COMPLETED'
            )
        ),

    CONSTRAINT ck_commercial_notice_period
        CHECK (
            notice_period_days
                BETWEEN 0 AND 1095
        ),

    CONSTRAINT ck_commercial_baseline_value
        CHECK (
            baseline_contract_value >= 0
        ),

    CONSTRAINT ck_commercial_currency
        CHECK (
            CHAR_LENGTH(currency) = 3
        ),

    CONSTRAINT ck_commercial_price_escalation
        CHECK (
            price_escalation_pct
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_commercial_po_variance
        CHECK (
            max_po_variance_pct
                BETWEEN 0 AND 100
        )
);

CREATE TABLE contract_obligations (
    id UUID PRIMARY KEY,

    governance_id
        UUID
        NOT NULL,

    obligation_type
        VARCHAR(40)
        NOT NULL,

    title
        VARCHAR(220)
        NOT NULL,

    description
        VARCHAR(2000),

    due_date
        DATE
        NOT NULL,

    critical
        BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    status
        VARCHAR(20)
        NOT NULL,

    owner_user_id
        UUID
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

    CONSTRAINT fk_contract_obligation_governance
        FOREIGN KEY (
            governance_id
        )
        REFERENCES contract_commercial_governance (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_contract_obligation_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_contract_obligation_type
        CHECK (
            obligation_type IN (
                'DELIVERY',
                'SERVICE_LEVEL',
                'REPORTING',
                'COMPLIANCE',
                'PAYMENT',
                'RENEWAL',
                'OTHER'
            )
        ),

    CONSTRAINT ck_contract_obligation_status
        CHECK (
            status IN (
                'OPEN',
                'COMPLETED',
                'WAIVED'
            )
        )
);

CREATE TABLE commercial_leakage_findings (
    id UUID PRIMARY KEY,

    source_key
        VARCHAR(255)
        NOT NULL,

    governance_id
        UUID,

    contract_id
        UUID,

    supplier_id
        UUID
        NOT NULL,

    purchase_order_id
        UUID,

    negotiation_workspace_id
        UUID,

    finding_type
        VARCHAR(50)
        NOT NULL,

    severity
        VARCHAR(20)
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    currency
        VARCHAR(3),

    expected_value
        NUMERIC(19, 2),

    actual_value
        NUMERIC(19, 2),

    leakage_amount
        NUMERIC(19, 2)
        NOT NULL,

    source_reference
        VARCHAR(120),

    details
        VARCHAR(3000)
        NOT NULL,

    detected_at
        TIMESTAMPTZ
        NOT NULL,

    last_checked_at
        TIMESTAMPTZ
        NOT NULL,

    resolved_by_user_id
        UUID,

    resolution_note
        VARCHAR(2000),

    resolved_at
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

    CONSTRAINT uk_commercial_leakage_source
        UNIQUE (
            source_key
        ),

    CONSTRAINT fk_commercial_leakage_governance
        FOREIGN KEY (
            governance_id
        )
        REFERENCES contract_commercial_governance (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_commercial_leakage_contract
        FOREIGN KEY (
            contract_id
        )
        REFERENCES supplier_contracts (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_commercial_leakage_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id),

    CONSTRAINT fk_commercial_leakage_po
        FOREIGN KEY (
            purchase_order_id
        )
        REFERENCES purchase_orders (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_commercial_leakage_negotiation
        FOREIGN KEY (
            negotiation_workspace_id
        )
        REFERENCES procurement_negotiation_workspaces (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_commercial_leakage_resolver
        FOREIGN KEY (
            resolved_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_commercial_leakage_type
        CHECK (
            finding_type IN (
                'NO_ACTIVE_CONTRACT',
                'EXPIRED_CONTRACT',
                'PO_VALUE_VARIANCE',
                'PRICE_ESCALATION_BREACH',
                'NEGOTIATED_VALUE_VARIANCE'
            )
        ),

    CONSTRAINT ck_commercial_leakage_severity
        CHECK (
            severity IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_commercial_leakage_status
        CHECK (
            status IN (
                'OPEN',
                'RESOLVED',
                'DISMISSED'
            )
        ),

    CONSTRAINT ck_commercial_leakage_amount
        CHECK (
            leakage_amount >= 0
        )
);

CREATE INDEX idx_contract_governance_status
    ON contract_commercial_governance (
        status,
        renewal_status,
        notice_deadline
    );

CREATE INDEX idx_contract_governance_supplier
    ON contract_commercial_governance (
        supplier_id,
        status
    );

CREATE INDEX idx_contract_obligation_due
    ON contract_obligations (
        due_date,
        status
    );

CREATE INDEX idx_contract_obligation_governance
    ON contract_obligations (
        governance_id,
        status
    );

CREATE INDEX idx_commercial_leakage_status
    ON commercial_leakage_findings (
        status,
        severity,
        detected_at DESC
    );

CREATE INDEX idx_commercial_leakage_supplier
    ON commercial_leakage_findings (
        supplier_id,
        status
    );

CREATE INDEX idx_commercial_leakage_governance
    ON commercial_leakage_findings (
        governance_id,
        status
    );

CREATE INDEX idx_commercial_leakage_po
    ON commercial_leakage_findings (
        purchase_order_id
    );

CREATE TRIGGER trg_audit_contract_commercial_governance
AFTER INSERT OR UPDATE OR DELETE
ON contract_commercial_governance
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_contract_obligations
AFTER INSERT OR UPDATE OR DELETE
ON contract_obligations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_commercial_leakage_findings
AFTER INSERT OR UPDATE OR DELETE
ON commercial_leakage_findings
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
