CREATE SEQUENCE procurement_policy_code_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE policy_waiver_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_policies (
    id UUID PRIMARY KEY,

    policy_code
        VARCHAR(60)
        NOT NULL,

    name
        VARCHAR(220)
        NOT NULL,

    description
        VARCHAR(2000),

    policy_type
        VARCHAR(60)
        NOT NULL,

    severity
        VARCHAR(20)
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    threshold_amount
        NUMERIC(19, 2),

    currency
        VARCHAR(3),

    requires_waiver
        BOOLEAN
        NOT NULL
        DEFAULT TRUE,

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

    CONSTRAINT uk_procurement_policy_code
        UNIQUE (
            policy_code
        ),

    CONSTRAINT fk_procurement_policy_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_procurement_policy_type
        CHECK (
            policy_type IN (
                'COMPETITIVE_SOURCING_THRESHOLD',
                'PURCHASE_ORDER_REQUIRED_THRESHOLD',
                'CONTRACT_REQUIRED_THRESHOLD',
                'HIGH_RISK_SUPPLIER_RESTRICTION'
            )
        ),

    CONSTRAINT ck_procurement_policy_severity
        CHECK (
            severity IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_procurement_policy_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE'
            )
        ),

    CONSTRAINT ck_procurement_policy_threshold
        CHECK (
            threshold_amount IS NULL
            OR threshold_amount >= 0
        ),

    CONSTRAINT ck_procurement_policy_currency
        CHECK (
            currency IS NULL
            OR CHAR_LENGTH(currency) = 3
        )
);

CREATE TABLE procurement_policy_violations (
    id UUID PRIMARY KEY,

    policy_id
        UUID
        NOT NULL,

    source_key
        VARCHAR(255)
        NOT NULL,

    source_type
        VARCHAR(40)
        NOT NULL,

    source_id
        UUID
        NOT NULL,

    source_reference
        VARCHAR(100),

    source_amount
        NUMERIC(19, 2),

    currency
        VARCHAR(3),

    severity
        VARCHAR(20)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

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

    CONSTRAINT uk_policy_violation_source
        UNIQUE (
            source_key
        ),

    CONSTRAINT fk_policy_violation_policy
        FOREIGN KEY (
            policy_id
        )
        REFERENCES procurement_policies (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_policy_violation_resolver
        FOREIGN KEY (
            resolved_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_policy_violation_source_type
        CHECK (
            source_type IN (
                'PURCHASE_REQUEST',
                'PURCHASE_ORDER'
            )
        ),

    CONSTRAINT ck_policy_violation_severity
        CHECK (
            severity IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_policy_violation_status
        CHECK (
            status IN (
                'OPEN',
                'WAIVER_REQUESTED',
                'WAIVED',
                'RESOLVED',
                'DISMISSED'
            )
        )
);

CREATE TABLE procurement_policy_waivers (
    id UUID PRIMARY KEY,

    waiver_number
        VARCHAR(50)
        NOT NULL,

    violation_id
        UUID
        NOT NULL,

    rationale
        VARCHAR(3000)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    requested_by_user_id
        UUID
        NOT NULL,

    requested_at
        TIMESTAMPTZ
        NOT NULL,

    decided_by_user_id
        UUID,

    decision_note
        VARCHAR(2000),

    decided_at
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

    CONSTRAINT uk_procurement_policy_waiver_number
        UNIQUE (
            waiver_number
        ),

    CONSTRAINT fk_policy_waiver_violation
        FOREIGN KEY (
            violation_id
        )
        REFERENCES procurement_policy_violations (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_policy_waiver_requester
        FOREIGN KEY (
            requested_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_policy_waiver_decider
        FOREIGN KEY (
            decided_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_policy_waiver_status
        CHECK (
            status IN (
                'SUBMITTED',
                'APPROVED',
                'REJECTED',
                'CANCELLED'
            )
        )
);

CREATE TABLE procurement_policy_evidence (
    id UUID PRIMARY KEY,

    violation_id
        UUID
        NOT NULL,

    evidence_type
        VARCHAR(30)
        NOT NULL,

    content
        VARCHAR(3000)
        NOT NULL,

    added_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_policy_evidence_violation
        FOREIGN KEY (
            violation_id
        )
        REFERENCES procurement_policy_violations (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_policy_evidence_user
        FOREIGN KEY (
            added_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_policy_evidence_type
        CHECK (
            evidence_type IN (
                'NOTE',
                'REFERENCE'
            )
        )
);

CREATE INDEX idx_procurement_policy_status
    ON procurement_policies (
        status,
        policy_type
    );

CREATE INDEX idx_policy_violation_status
    ON procurement_policy_violations (
        status,
        severity,
        detected_at DESC
    );

CREATE INDEX idx_policy_violation_policy
    ON procurement_policy_violations (
        policy_id,
        status
    );

CREATE INDEX idx_policy_violation_source
    ON procurement_policy_violations (
        source_type,
        source_id
    );

CREATE INDEX idx_policy_waiver_violation
    ON procurement_policy_waivers (
        violation_id,
        status
    );

CREATE INDEX idx_policy_waiver_status
    ON procurement_policy_waivers (
        status,
        requested_at
    );

CREATE INDEX idx_policy_evidence_violation
    ON procurement_policy_evidence (
        violation_id,
        created_at DESC
    );

CREATE TRIGGER trg_audit_procurement_policies
AFTER INSERT OR UPDATE OR DELETE
ON procurement_policies
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_policy_violations
AFTER INSERT OR UPDATE OR DELETE
ON procurement_policy_violations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_policy_waivers
AFTER INSERT OR UPDATE OR DELETE
ON procurement_policy_waivers
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_policy_evidence
AFTER INSERT OR UPDATE OR DELETE
ON procurement_policy_evidence
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
