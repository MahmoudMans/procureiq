CREATE SEQUENCE supplier_onboarding_case_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE supplier_onboarding_cases (
    id UUID PRIMARY KEY,

    case_number
        VARCHAR(50)
        NOT NULL,

    supplier_id
        UUID
        NOT NULL,

    case_type
        VARCHAR(30)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    risk_tier
        VARCHAR(20)
        NOT NULL,

    owner_user_id
        UUID
        NOT NULL,

    activation_clearance
        BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    sla_due_at
        TIMESTAMPTZ
        NOT NULL,

    submitted_at
        TIMESTAMPTZ,

    decision_at
        TIMESTAMPTZ,

    requalification_due_date
        DATE,

    decision_note
        VARCHAR(2000),

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

    CONSTRAINT uk_supplier_onboarding_case_number
        UNIQUE (
            case_number
        ),

    CONSTRAINT fk_onboarding_case_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_onboarding_case_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_onboarding_case_type
        CHECK (
            case_type IN (
                'INITIAL',
                'REQUALIFICATION'
            )
        ),

    CONSTRAINT ck_onboarding_case_status
        CHECK (
            status IN (
                'DRAFT',
                'IN_REVIEW',
                'APPROVED',
                'REJECTED',
                'EXPIRED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_onboarding_risk_tier
        CHECK (
            risk_tier IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        )
);

CREATE UNIQUE INDEX uk_supplier_open_onboarding_case
    ON supplier_onboarding_cases (
        supplier_id
    )
    WHERE status IN (
        'DRAFT',
        'IN_REVIEW'
    );

CREATE TABLE supplier_onboarding_questions (
    id UUID PRIMARY KEY,

    case_id
        UUID
        NOT NULL,

    question_code
        VARCHAR(100)
        NOT NULL,

    question_label
        VARCHAR(500)
        NOT NULL,

    mandatory
        BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    answer_value
        VARCHAR(2000),

    compliance_status
        VARCHAR(30)
        NOT NULL,

    answered_by_user_id
        UUID,

    answered_at
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

    CONSTRAINT fk_onboarding_question_case
        FOREIGN KEY (
            case_id
        )
        REFERENCES supplier_onboarding_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_onboarding_question_user
        FOREIGN KEY (
            answered_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_onboarding_question_code
        UNIQUE (
            case_id,
            question_code
        ),

    CONSTRAINT ck_onboarding_question_compliance
        CHECK (
            compliance_status IN (
                'PENDING',
                'COMPLIANT',
                'NON_COMPLIANT'
            )
        )
);

CREATE TABLE supplier_onboarding_evidence (
    id UUID PRIMARY KEY,

    case_id
        UUID
        NOT NULL,

    evidence_type
        VARCHAR(50)
        NOT NULL,

    mandatory
        BOOLEAN
        NOT NULL,

    document_reference
        VARCHAR(500),

    expiry_date
        DATE,

    status
        VARCHAR(30)
        NOT NULL,

    reviewed_by_user_id
        UUID,

    review_note
        VARCHAR(2000),

    reviewed_at
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

    CONSTRAINT fk_onboarding_evidence_case
        FOREIGN KEY (
            case_id
        )
        REFERENCES supplier_onboarding_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_onboarding_evidence_reviewer
        FOREIGN KEY (
            reviewed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_onboarding_evidence_type
        UNIQUE (
            case_id,
            evidence_type
        ),

    CONSTRAINT ck_onboarding_evidence_type
        CHECK (
            evidence_type IN (
                'COMPANY_REGISTRATION',
                'TAX_REGISTRATION',
                'BANK_INFORMATION',
                'INSURANCE',
                'COMPLIANCE_DECLARATION'
            )
        ),

    CONSTRAINT ck_onboarding_evidence_status
        CHECK (
            status IN (
                'MISSING',
                'UPLOADED',
                'VALID',
                'REJECTED'
            )
        )
);

CREATE TABLE supplier_onboarding_approvals (
    id UUID PRIMARY KEY,

    case_id
        UUID
        NOT NULL,

    approval_level
        VARCHAR(30)
        NOT NULL,

    required
        BOOLEAN
        NOT NULL,

    status
        VARCHAR(20)
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

    CONSTRAINT fk_onboarding_approval_case
        FOREIGN KEY (
            case_id
        )
        REFERENCES supplier_onboarding_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_onboarding_approval_decider
        FOREIGN KEY (
            decided_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_onboarding_approval_level
        UNIQUE (
            case_id,
            approval_level
        ),

    CONSTRAINT ck_onboarding_approval_level
        CHECK (
            approval_level IN (
                'PROCUREMENT',
                'COMPLIANCE',
                'RISK'
            )
        ),

    CONSTRAINT ck_onboarding_approval_status
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED'
            )
        )
);

CREATE INDEX idx_onboarding_case_status
    ON supplier_onboarding_cases (
        status,
        risk_tier,
        sla_due_at
    );

CREATE INDEX idx_onboarding_case_supplier
    ON supplier_onboarding_cases (
        supplier_id,
        created_at DESC
    );

CREATE INDEX idx_onboarding_requalification
    ON supplier_onboarding_cases (
        requalification_due_date,
        status
    );

CREATE INDEX idx_onboarding_evidence_expiry
    ON supplier_onboarding_evidence (
        expiry_date,
        status
    );

CREATE INDEX idx_onboarding_approval_case
    ON supplier_onboarding_approvals (
        case_id,
        required,
        status
    );

CREATE TRIGGER trg_audit_supplier_onboarding_cases
AFTER INSERT OR UPDATE OR DELETE
ON supplier_onboarding_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_supplier_onboarding_questions
AFTER INSERT OR UPDATE OR DELETE
ON supplier_onboarding_questions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_supplier_onboarding_evidence
AFTER INSERT OR UPDATE OR DELETE
ON supplier_onboarding_evidence
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_supplier_onboarding_approvals
AFTER INSERT OR UPDATE OR DELETE
ON supplier_onboarding_approvals
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
