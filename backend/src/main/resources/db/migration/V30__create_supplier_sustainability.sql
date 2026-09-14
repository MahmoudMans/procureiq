CREATE SEQUENCE sustainability_assessment_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE supplier_sustainability_assessments (
    id UUID PRIMARY KEY,

    assessment_number
        VARCHAR(50)
        NOT NULL,

    supplier_id
        UUID
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    environmental_score
        NUMERIC(6, 2)
        NOT NULL,

    social_score
        NUMERIC(6, 2)
        NOT NULL,

    governance_score
        NUMERIC(6, 2)
        NOT NULL,

    overall_score
        NUMERIC(6, 2)
        NOT NULL,

    rating
        VARCHAR(30)
        NOT NULL,

    assessment_date
        DATE
        NOT NULL,

    next_review_date
        DATE,

    owner_user_id
        UUID
        NOT NULL,

    reviewed_by_user_id
        UUID,

    review_note
        VARCHAR(2000),

    reviewed_at
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

    CONSTRAINT uk_sustainability_assessment_number
        UNIQUE (
            assessment_number
        ),

    CONSTRAINT fk_sustainability_assessment_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sustainability_assessment_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_sustainability_assessment_reviewer
        FOREIGN KEY (
            reviewed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_sustainability_assessment_status
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'APPROVED',
                'REJECTED',
                'EXPIRED'
            )
        ),

    CONSTRAINT ck_environmental_score
        CHECK (
            environmental_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_social_score
        CHECK (
            social_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_governance_score
        CHECK (
            governance_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_overall_sustainability_score
        CHECK (
            overall_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_sustainability_rating
        CHECK (
            rating IN (
                'LEADING',
                'GOOD',
                'MODERATE',
                'HIGH_RISK',
                'CRITICAL'
            )
        )
);

CREATE UNIQUE INDEX uk_supplier_open_sustainability_assessment
    ON supplier_sustainability_assessments (
        supplier_id
    )
    WHERE status IN (
        'DRAFT',
        'SUBMITTED'
    );

CREATE TABLE supplier_sustainability_declarations (
    id UUID PRIMARY KEY,

    assessment_id
        UUID
        NOT NULL,

    declaration_type
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

    CONSTRAINT fk_sustainability_declaration_assessment
        FOREIGN KEY (
            assessment_id
        )
        REFERENCES supplier_sustainability_assessments (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sustainability_declaration_reviewer
        FOREIGN KEY (
            reviewed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_sustainability_declaration_type
        UNIQUE (
            assessment_id,
            declaration_type
        ),

    CONSTRAINT ck_sustainability_declaration_type
        CHECK (
            declaration_type IN (
                'HUMAN_RIGHTS',
                'MODERN_SLAVERY',
                'ANTI_BRIBERY',
                'ENVIRONMENTAL_POLICY',
                'RESPONSIBLE_SOURCING',
                'DIVERSITY_INCLUSION'
            )
        ),

    CONSTRAINT ck_sustainability_declaration_status
        CHECK (
            status IN (
                'MISSING',
                'DECLARED',
                'VERIFIED',
                'REJECTED'
            )
        )
);

CREATE TABLE supplier_sustainability_actions (
    id UUID PRIMARY KEY,

    assessment_id
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

    CONSTRAINT fk_sustainability_action_assessment
        FOREIGN KEY (
            assessment_id
        )
        REFERENCES supplier_sustainability_assessments (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sustainability_action_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_sustainability_action_type
        CHECK (
            action_type IN (
                'CARBON_REDUCTION',
                'LABOR_PRACTICES',
                'GOVERNANCE_CONTROL',
                'RESPONSIBLE_SOURCING',
                'EVIDENCE_REMEDIATION',
                'OTHER'
            )
        ),

    CONSTRAINT ck_sustainability_action_status
        CHECK (
            status IN (
                'OPEN',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        )
);

CREATE INDEX idx_sustainability_assessment_supplier
    ON supplier_sustainability_assessments (
        supplier_id,
        created_at DESC
    );

CREATE INDEX idx_sustainability_assessment_status
    ON supplier_sustainability_assessments (
        status,
        rating,
        next_review_date
    );

CREATE INDEX idx_sustainability_declaration_expiry
    ON supplier_sustainability_declarations (
        expiry_date,
        status
    );

CREATE INDEX idx_sustainability_action_status
    ON supplier_sustainability_actions (
        status,
        due_date
    );

CREATE INDEX idx_sustainability_action_assessment
    ON supplier_sustainability_actions (
        assessment_id,
        status
    );

CREATE TRIGGER trg_audit_supplier_sustainability_assessments
AFTER INSERT OR UPDATE OR DELETE
ON supplier_sustainability_assessments
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_supplier_sustainability_declarations
AFTER INSERT OR UPDATE OR DELETE
ON supplier_sustainability_declarations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_supplier_sustainability_actions
AFTER INSERT OR UPDATE OR DELETE
ON supplier_sustainability_actions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
