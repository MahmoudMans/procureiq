CREATE TABLE data_quality_rules (
    id BIGSERIAL PRIMARY KEY,

    rule_code
        VARCHAR(120)
        NOT NULL,

    domain
        VARCHAR(30)
        NOT NULL,

    title
        VARCHAR(220)
        NOT NULL,

    description
        VARCHAR(2000)
        NOT NULL,

    severity
        VARCHAR(20)
        NOT NULL,

    weight
        NUMERIC(9, 2)
        NOT NULL,

    enabled
        BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_data_quality_rule_code
        UNIQUE (
            rule_code
        ),

    CONSTRAINT ck_data_quality_rule_domain
        CHECK (
            domain IN (
                'SUPPLIER',
                'TRANSACTION',
                'PROCESS'
            )
        ),

    CONSTRAINT ck_data_quality_rule_severity
        CHECK (
            severity IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_data_quality_rule_weight
        CHECK (
            weight
                BETWEEN 0 AND 100
        )
);

CREATE TABLE data_quality_findings (
    id UUID PRIMARY KEY,

    finding_key
        VARCHAR(300)
        NOT NULL,

    rule_id
        BIGINT
        NOT NULL,

    entity_type
        VARCHAR(60)
        NOT NULL,

    entity_id
        UUID
        NOT NULL,

    related_entity_id
        UUID,

    entity_reference
        VARCHAR(220),

    details
        VARCHAR(3000)
        NOT NULL,

    status
        VARCHAR(40)
        NOT NULL,

    detected_at
        TIMESTAMPTZ
        NOT NULL,

    last_seen_at
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

    CONSTRAINT uk_data_quality_finding_key
        UNIQUE (
            finding_key
        ),

    CONSTRAINT fk_data_quality_finding_rule
        FOREIGN KEY (
            rule_id
        )
        REFERENCES data_quality_rules (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_data_quality_finding_resolver
        FOREIGN KEY (
            resolved_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_data_quality_finding_status
        CHECK (
            status IN (
                'OPEN',
                'REMEDIATION_IN_PROGRESS',
                'RESOLVED',
                'DISMISSED'
            )
        )
);

CREATE TABLE data_quality_remediation_tasks (
    id UUID PRIMARY KEY,

    finding_id
        UUID
        NOT NULL,

    title
        VARCHAR(220)
        NOT NULL,

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

    CONSTRAINT fk_data_quality_task_finding
        FOREIGN KEY (
            finding_id
        )
        REFERENCES data_quality_findings (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_data_quality_task_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_data_quality_task_status
        CHECK (
            status IN (
                'OPEN',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        )
);

CREATE INDEX idx_data_quality_rule_enabled
    ON data_quality_rules (
        enabled,
        domain,
        severity
    );

CREATE INDEX idx_data_quality_finding_status
    ON data_quality_findings (
        status,
        rule_id,
        last_seen_at DESC
    );

CREATE INDEX idx_data_quality_finding_entity
    ON data_quality_findings (
        entity_type,
        entity_id
    );

CREATE INDEX idx_data_quality_task_status
    ON data_quality_remediation_tasks (
        status,
        due_date
    );

CREATE INDEX idx_data_quality_task_finding
    ON data_quality_remediation_tasks (
        finding_id,
        status
    );

INSERT INTO data_quality_rules (
    rule_code,
    domain,
    title,
    description,
    severity,
    weight,
    enabled,
    created_at,
    updated_at
)
VALUES
    (
        'SUPPLIER_DUPLICATE_NAME',
        'SUPPLIER',
        'Potential duplicate supplier',
        'Two active supplier records have the same normalized legal name and country.',
        'HIGH',
        25,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'SUPPLIER_CATEGORY_MISSING',
        'SUPPLIER',
        'Supplier category missing',
        'An active supplier does not have a procurement category.',
        'MEDIUM',
        10,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'SUPPLIER_COUNTRY_MISSING',
        'SUPPLIER',
        'Supplier country missing',
        'An active supplier does not have a country value.',
        'MEDIUM',
        10,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'SUPPLIER_RATING_MISSING',
        'SUPPLIER',
        'Supplier rating missing',
        'An active supplier does not have a supplier rating.',
        'LOW',
        5,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'SUPPLIER_RISK_MISSING',
        'SUPPLIER',
        'Supplier risk classification missing',
        'An active supplier does not have a supplier risk classification.',
        'HIGH',
        15,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'SUPPLIER_NAME_WHITESPACE',
        'SUPPLIER',
        'Supplier legal name needs normalization',
        'Supplier legal name contains leading or trailing whitespace.',
        'LOW',
        3,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'SUPPLIER_CODE_WHITESPACE',
        'SUPPLIER',
        'Supplier code needs normalization',
        'Supplier code contains leading or trailing whitespace.',
        'LOW',
        3,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'INACTIVE_SUPPLIER_OPEN_PO',
        'TRANSACTION',
        'Open purchase order references inactive supplier',
        'An active purchase-order workflow references a supplier that is no longer active.',
        'CRITICAL',
        25,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'INVOICE_SUPPLIER_MISMATCH',
        'TRANSACTION',
        'Invoice supplier differs from purchase order',
        'Procurement invoice supplier does not match the supplier on its purchase order.',
        'CRITICAL',
        30,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'INVOICE_CURRENCY_MISMATCH',
        'TRANSACTION',
        'Invoice currency differs from purchase order',
        'Procurement invoice currency does not match the linked purchase-order currency.',
        'HIGH',
        20,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'PROCESS_REFERENCE_MISSING',
        'PROCESS',
        'Process-event reference missing',
        'A procurement process entity does not expose a usable process reference.',
        'MEDIUM',
        20,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );

CREATE TRIGGER trg_audit_data_quality_rules
AFTER INSERT OR UPDATE OR DELETE
ON data_quality_rules
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_data_quality_findings
AFTER INSERT OR UPDATE OR DELETE
ON data_quality_findings
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_data_quality_remediation_tasks
AFTER INSERT OR UPDATE OR DELETE
ON data_quality_remediation_tasks
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
