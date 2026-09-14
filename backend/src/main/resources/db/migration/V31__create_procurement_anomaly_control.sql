CREATE SEQUENCE procurement_investigation_case_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_anomaly_rules (
    id BIGSERIAL PRIMARY KEY,

    rule_code
        VARCHAR(120)
        NOT NULL,

    signal_type
        VARCHAR(30)
        NOT NULL,

    title
        VARCHAR(220)
        NOT NULL,

    description
        VARCHAR(2500)
        NOT NULL,

    default_severity
        VARCHAR(20)
        NOT NULL,

    score_weight
        NUMERIC(9, 2)
        NOT NULL,

    threshold_value
        NUMERIC(19, 4)
        NOT NULL,

    lookback_days
        INTEGER
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

    CONSTRAINT uk_procurement_anomaly_rule_code
        UNIQUE (
            rule_code
        ),

    CONSTRAINT ck_procurement_anomaly_signal_type
        CHECK (
            signal_type IN (
                'INVOICE',
                'SPEND',
                'COMMERCIAL',
                'PROCESS'
            )
        ),

    CONSTRAINT ck_procurement_anomaly_rule_severity
        CHECK (
            default_severity IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_procurement_anomaly_rule_weight
        CHECK (
            score_weight
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_procurement_anomaly_threshold
        CHECK (
            threshold_value >= 0
        ),

    CONSTRAINT ck_procurement_anomaly_lookback
        CHECK (
            lookback_days
                BETWEEN 1 AND 3650
        )
);

CREATE TABLE procurement_anomaly_findings (
    id UUID PRIMARY KEY,

    finding_key
        VARCHAR(350)
        NOT NULL,

    rule_id
        BIGINT
        NOT NULL,

    entity_type
        VARCHAR(80)
        NOT NULL,

    entity_id
        UUID
        NOT NULL,

    related_entity_id
        UUID,

    entity_reference
        VARCHAR(300),

    currency
        VARCHAR(3),

    exposure_value
        NUMERIC(19, 2),

    metric_value
        NUMERIC(19, 4),

    anomaly_score
        NUMERIC(6, 2)
        NOT NULL,

    details
        VARCHAR(3500)
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

    disposed_by_user_id
        UUID,

    disposition_note
        VARCHAR(2500),

    disposed_at
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

    CONSTRAINT uk_procurement_anomaly_finding_key
        UNIQUE (
            finding_key
        ),

    CONSTRAINT fk_procurement_anomaly_finding_rule
        FOREIGN KEY (
            rule_id
        )
        REFERENCES procurement_anomaly_rules (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_procurement_anomaly_finding_disposer
        FOREIGN KEY (
            disposed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_procurement_anomaly_score
        CHECK (
            anomaly_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_procurement_anomaly_finding_status
        CHECK (
            status IN (
                'OPEN',
                'UNDER_INVESTIGATION',
                'CONFIRMED',
                'DISMISSED',
                'RESOLVED'
            )
        )
);

CREATE TABLE procurement_investigation_cases (
    id UUID PRIMARY KEY,

    case_number
        VARCHAR(50)
        NOT NULL,

    finding_id
        UUID
        NOT NULL,

    owner_user_id
        UUID
        NOT NULL,

    priority
        VARCHAR(20)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    due_date
        DATE
        NOT NULL,

    conclusion
        VARCHAR(3000),

    closed_at
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

    CONSTRAINT uk_procurement_investigation_case_number
        UNIQUE (
            case_number
        ),

    CONSTRAINT fk_investigation_finding
        FOREIGN KEY (
            finding_id
        )
        REFERENCES procurement_anomaly_findings (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_investigation_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_investigation_priority
        CHECK (
            priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_investigation_status
        CHECK (
            status IN (
                'OPEN',
                'IN_PROGRESS',
                'CLOSED',
                'CANCELLED'
            )
        )
);

CREATE UNIQUE INDEX uk_active_investigation_finding
    ON procurement_investigation_cases (
        finding_id
    )
    WHERE status IN (
        'OPEN',
        'IN_PROGRESS'
    );

CREATE TABLE procurement_investigation_evidence (
    id UUID PRIMARY KEY,

    investigation_id
        UUID
        NOT NULL,

    evidence_type
        VARCHAR(40)
        NOT NULL,

    reference_text
        VARCHAR(3000)
        NOT NULL,

    added_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_investigation_evidence_case
        FOREIGN KEY (
            investigation_id
        )
        REFERENCES procurement_investigation_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_investigation_evidence_user
        FOREIGN KEY (
            added_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_investigation_evidence_type
        CHECK (
            evidence_type IN (
                'NOTE',
                'TRANSACTION_REFERENCE',
                'DOCUMENT_REFERENCE',
                'CONTROL_TEST'
            )
        )
);

CREATE INDEX idx_anomaly_rule_enabled
    ON procurement_anomaly_rules (
        enabled,
        signal_type,
        default_severity
    );

CREATE INDEX idx_anomaly_finding_status
    ON procurement_anomaly_findings (
        status,
        rule_id,
        anomaly_score DESC
    );

CREATE INDEX idx_anomaly_finding_entity
    ON procurement_anomaly_findings (
        entity_type,
        entity_id
    );

CREATE INDEX idx_anomaly_finding_currency
    ON procurement_anomaly_findings (
        currency,
        status
    );

CREATE INDEX idx_investigation_status
    ON procurement_investigation_cases (
        status,
        priority,
        due_date
    );

CREATE INDEX idx_investigation_finding
    ON procurement_investigation_cases (
        finding_id,
        created_at DESC
    );

CREATE INDEX idx_investigation_evidence_case
    ON procurement_investigation_evidence (
        investigation_id,
        created_at DESC
    );

INSERT INTO procurement_anomaly_rules (
    rule_code,
    signal_type,
    title,
    description,
    default_severity,
    score_weight,
    threshold_value,
    lookback_days,
    enabled,
    created_at,
    updated_at
)
VALUES
    (
        'DUPLICATE_SUPPLIER_INVOICE_REFERENCE',
        'INVOICE',
        'Duplicate supplier invoice reference',
        'The same supplier invoice reference appears on multiple non-cancelled procurement invoices.',
        'CRITICAL',
        25,
        2,
        365,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'REPEATED_INVOICE_VALUE_PATTERN',
        'INVOICE',
        'Repeated invoice value pattern',
        'The same supplier repeatedly submits invoices for the exact same amount within the configured lookback window.',
        'HIGH',
        18,
        3,
        30,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'HIGH_VALUE_ROUND_INVOICE',
        'INVOICE',
        'High-value round-number invoice',
        'A high-value invoice is an exact multiple of 1,000 and warrants control review when above the configured threshold.',
        'MEDIUM',
        10,
        10000,
        90,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'SPLIT_PURCHASE_INDICATOR',
        'SPEND',
        'Potential split-purchase pattern',
        'Multiple purchase orders to the same supplier on the same day are individually below the threshold while their combined value meets or exceeds it.',
        'HIGH',
        22,
        10000,
        90,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'SUPPLIER_CATEGORY_CONCENTRATION',
        'SPEND',
        'Supplier category concentration',
        'A single supplier represents an unusually high share of purchase-order spend in its category.',
        'MEDIUM',
        12,
        50,
        365,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'OPEN_COMMERCIAL_LEAKAGE',
        'COMMERCIAL',
        'Open commercial leakage',
        'An unresolved commercial leakage finding remains above the configured monetary threshold.',
        'HIGH',
        20,
        1000,
        365,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'OFF_CONTRACT_BUYING',
        'COMMERCIAL',
        'Off-contract buying indicator',
        'An unresolved commercial leakage finding identifies off-contract procurement activity.',
        'HIGH',
        20,
        0,
        365,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'REPEATED_PROCESS_STAGE',
        'PROCESS',
        'Repeated process-stage pattern',
        'The same procurement entity repeatedly re-enters the same workflow stage within the configured lookback window.',
        'MEDIUM',
        12,
        2,
        90,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );

CREATE TRIGGER trg_audit_procurement_anomaly_rules
AFTER INSERT OR UPDATE OR DELETE
ON procurement_anomaly_rules
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_anomaly_findings
AFTER INSERT OR UPDATE OR DELETE
ON procurement_anomaly_findings
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_investigation_cases
AFTER INSERT OR UPDATE OR DELETE
ON procurement_investigation_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_investigation_evidence
AFTER INSERT OR UPDATE OR DELETE
ON procurement_investigation_evidence
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
