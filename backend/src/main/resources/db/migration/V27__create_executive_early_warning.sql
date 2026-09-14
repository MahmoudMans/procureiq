CREATE TABLE executive_early_warning_rules (
    id BIGSERIAL PRIMARY KEY,

    rule_code
        VARCHAR(100)
        NOT NULL,

    signal_type
        VARCHAR(30)
        NOT NULL,

    nature
        VARCHAR(20)
        NOT NULL,

    title
        VARCHAR(220)
        NOT NULL,

    description
        VARCHAR(2000)
        NOT NULL,

    recommendation
        VARCHAR(3000)
        NOT NULL,

    default_severity
        VARCHAR(20)
        NOT NULL,

    threshold_value
        NUMERIC(19, 4)
        NOT NULL
        DEFAULT 0,

    lookahead_days
        INTEGER
        NOT NULL
        DEFAULT 0,

    enabled
        BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    priority
        INTEGER
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_executive_warning_rule_code
        UNIQUE (
            rule_code
        ),

    CONSTRAINT ck_executive_signal_type
        CHECK (
            signal_type IN (
                'PROCESS',
                'INVOICE',
                'CONTRACT',
                'SUPPLIER',
                'NEGOTIATION',
                'DEMAND'
            )
        ),

    CONSTRAINT ck_executive_signal_nature
        CHECK (
            nature IN (
                'RISK',
                'OPPORTUNITY'
            )
        ),

    CONSTRAINT ck_executive_warning_severity
        CHECK (
            default_severity IN (
                'INFO',
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_executive_threshold
        CHECK (
            threshold_value >= 0
        ),

    CONSTRAINT ck_executive_lookahead
        CHECK (
            lookahead_days
                BETWEEN 0 AND 1095
        ),

    CONSTRAINT ck_executive_priority
        CHECK (
            priority
                BETWEEN 1 AND 100
        )
);

CREATE TABLE executive_warning_acknowledgements (
    id UUID PRIMARY KEY,

    warning_key
        VARCHAR(255)
        NOT NULL,

    rule_id
        BIGINT
        NOT NULL,

    acknowledged_by_user_id
        UUID
        NOT NULL,

    note
        VARCHAR(2000)
        NOT NULL,

    acknowledged_at
        TIMESTAMPTZ
        NOT NULL,

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_executive_warning_ack
        UNIQUE (
            warning_key
        ),

    CONSTRAINT fk_executive_warning_ack_rule
        FOREIGN KEY (
            rule_id
        )
        REFERENCES executive_early_warning_rules (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_executive_warning_ack_user
        FOREIGN KEY (
            acknowledged_by_user_id
        )
        REFERENCES app_users (id)
);

CREATE INDEX idx_executive_rule_enabled
    ON executive_early_warning_rules (
        enabled,
        priority,
        signal_type
    );

CREATE INDEX idx_executive_ack_rule
    ON executive_warning_acknowledgements (
        rule_id,
        acknowledged_at DESC
    );

INSERT INTO executive_early_warning_rules (
    rule_code,
    signal_type,
    nature,
    title,
    description,
    recommendation,
    default_severity,
    threshold_value,
    lookahead_days,
    enabled,
    priority,
    created_at,
    updated_at
)
VALUES
    (
        'PROCESS_STAGE_SLA_BREACH',
        'PROCESS',
        'RISK',
        'Procurement stage exceeds SLA',
        'An active procurement workflow stage has remained open beyond its configured process target.',
        'Escalate the oldest process bottlenecks and review ownership, queue capacity and workflow routing.',
        'HIGH',
        1.00,
        0,
        TRUE,
        95,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'INVOICE_OVERDUE',
        'INVOICE',
        'RISK',
        'Supplier invoice overdue',
        'An unpaid supplier invoice is past its contractual or operational due date.',
        'Prioritize the invoice for exception clearance or payment scheduling to reduce AP aging.',
        'HIGH',
        0,
        0,
        TRUE,
        90,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'INVOICE_PAYMENT_HOLD',
        'INVOICE',
        'RISK',
        'Invoice payment hold',
        'A procurement invoice is actively blocked from payment.',
        'Review the hold rationale and unresolved match controls; release valid invoices promptly.',
        'HIGH',
        0,
        0,
        TRUE,
        88,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'CRITICAL_INVOICE_EXCEPTION',
        'INVOICE',
        'RISK',
        'Critical invoice exception',
        'A high or critical three-way-match exception remains unresolved.',
        'Resolve duplicate, currency, receipt or over-invoice exceptions before payment approval.',
        'CRITICAL',
        0,
        0,
        TRUE,
        98,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'COMMERCIAL_LEAKAGE',
        'CONTRACT',
        'RISK',
        'Commercial leakage exposure',
        'An open contract or transaction control finding indicates preventable commercial leakage.',
        'Validate the commercial baseline and remediate open leakage before additional supplier commitment.',
        'HIGH',
        1000,
        0,
        TRUE,
        96,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'CONTRACT_NOTICE_DEADLINE',
        'CONTRACT',
        'RISK',
        'Contract notice deadline approaching',
        'A governed contract is approaching its renewal or termination notice deadline.',
        'Start or complete the renewal decision before the contractual notice window closes.',
        'HIGH',
        0,
        30,
        TRUE,
        87,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'CRITICAL_OBLIGATION_OVERDUE',
        'CONTRACT',
        'RISK',
        'Critical contract obligation overdue',
        'A critical contractual obligation is past due and remains open.',
        'Escalate obligation ownership and record completion or approved waiver evidence.',
        'CRITICAL',
        0,
        0,
        TRUE,
        97,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'SUPPLIER_CAPACITY_AT_RISK',
        'SUPPLIER',
        'RISK',
        'Supplier capacity risk',
        'A governed supplier is marked constrained or at risk for delivery capacity.',
        'Validate supplier capacity, delivery commitments and mitigation actions before new sourcing commitments.',
        'HIGH',
        0,
        0,
        TRUE,
        91,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'SINGLE_SOURCE_CRITICAL_SUPPLIER',
        'SUPPLIER',
        'RISK',
        'Critical supplier has no alternate',
        'A critical or strategic supplier has no active same-category alternate supplier.',
        'Qualify alternate supply, reduce dependency or establish a documented continuity strategy.',
        'CRITICAL',
        0,
        0,
        TRUE,
        99,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'NEGOTIATION_TARGET_MISS',
        'NEGOTIATION',
        'RISK',
        'Negotiated agreement missed target',
        'A finalized negotiation agreement is above its configured negotiation target.',
        'Review concessions and ensure the commercial delta is reflected in award and purchase-order governance.',
        'MEDIUM',
        0,
        0,
        TRUE,
        75,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'DEMAND_SOURCING_DELAY',
        'DEMAND',
        'RISK',
        'Approved demand bundle awaiting sourcing',
        'An approved demand-consolidation bundle has reached its target sourcing date without an RFQ linkage.',
        'Launch the sourcing event or revise the sourcing plan to prevent demand and savings delay.',
        'HIGH',
        0,
        0,
        TRUE,
        82,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'DEMAND_SAVINGS_OPPORTUNITY',
        'DEMAND',
        'OPPORTUNITY',
        'High-value consolidation opportunity',
        'A demand-consolidation bundle contains a material expected savings opportunity that has not yet closed.',
        'Prioritize the bundle for review, approval or sourcing to convert expected leverage into realized value.',
        'MEDIUM',
        10000,
        0,
        TRUE,
        70,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );

CREATE TRIGGER trg_audit_executive_early_warning_rules
AFTER INSERT OR UPDATE OR DELETE
ON executive_early_warning_rules
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_executive_warning_acknowledgements
AFTER INSERT OR UPDATE OR DELETE
ON executive_warning_acknowledgements
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
