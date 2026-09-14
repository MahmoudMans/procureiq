CREATE SEQUENCE guided_buying_template_code_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE guided_buying_intake_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE guided_buying_templates (
    id UUID PRIMARY KEY,

    template_code
        VARCHAR(50)
        NOT NULL,

    name
        VARCHAR(220)
        NOT NULL,

    description
        VARCHAR(2000),

    category
        VARCHAR(120)
        NOT NULL,

    default_title
        VARCHAR(220),

    default_currency
        VARCHAR(3)
        NOT NULL,

    default_estimated_amount
        NUMERIC(19, 2),

    default_department_id
        UUID,

    active
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

    CONSTRAINT uk_guided_buying_template_code
        UNIQUE (
            template_code
        ),

    CONSTRAINT fk_guided_template_department
        FOREIGN KEY (
            default_department_id
        )
        REFERENCES departments (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_guided_template_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_guided_template_currency
        CHECK (
            CHAR_LENGTH(
                default_currency
            ) = 3
        ),

    CONSTRAINT ck_guided_template_amount
        CHECK (
            default_estimated_amount
                IS NULL
            OR
            default_estimated_amount
                >= 0
        )
);

CREATE TABLE preferred_supplier_categories (
    id UUID PRIMARY KEY,

    category
        VARCHAR(120)
        NOT NULL,

    supplier_id
        UUID
        NOT NULL,

    preference_rank
        INTEGER
        NOT NULL,

    active
        BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    notes
        VARCHAR(2000),

    created_by_user_id
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

    CONSTRAINT fk_preferred_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_preferred_supplier_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_preferred_supplier_rank
        CHECK (
            preference_rank
                BETWEEN 1 AND 99
        )
);

CREATE UNIQUE INDEX uk_active_preferred_supplier_category
    ON preferred_supplier_categories (
        LOWER(category),
        supplier_id
    )
    WHERE active = TRUE;

CREATE TABLE guided_buying_intakes (
    id UUID PRIMARY KEY,

    intake_number
        VARCHAR(50)
        NOT NULL,

    title
        VARCHAR(220)
        NOT NULL,

    description
        VARCHAR(2000),

    department_id
        UUID
        NOT NULL,

    category
        VARCHAR(120)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    estimated_amount
        NUMERIC(19, 2)
        NOT NULL,

    supplier_id
        UUID,

    template_id
        UUID,

    requester_user_id
        UUID
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    guidance_route
        VARCHAR(50)
        NOT NULL,

    guidance_summary
        VARCHAR(3000)
        NOT NULL,

    linked_purchase_request_id
        UUID,

    converted_at
        TIMESTAMPTZ,

    notes
        VARCHAR(2000),

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

    CONSTRAINT uk_guided_buying_intake_number
        UNIQUE (
            intake_number
        ),

    CONSTRAINT uk_guided_buying_linked_request
        UNIQUE (
            linked_purchase_request_id
        ),

    CONSTRAINT fk_guided_intake_department
        FOREIGN KEY (
            department_id
        )
        REFERENCES departments (id),

    CONSTRAINT fk_guided_intake_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_guided_intake_template
        FOREIGN KEY (
            template_id
        )
        REFERENCES guided_buying_templates (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_guided_intake_requester
        FOREIGN KEY (
            requester_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_guided_intake_purchase_request
        FOREIGN KEY (
            linked_purchase_request_id
        )
        REFERENCES purchase_requests (id)
        ON DELETE SET NULL,

    CONSTRAINT ck_guided_intake_currency
        CHECK (
            CHAR_LENGTH(
                currency
            ) = 3
        ),

    CONSTRAINT ck_guided_intake_amount
        CHECK (
            estimated_amount >= 0
        ),

    CONSTRAINT ck_guided_intake_status
        CHECK (
            status IN (
                'DRAFT',
                'READY',
                'CONVERTED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_guided_intake_route
        CHECK (
            guidance_route IN (
                'DIRECT_BUY',
                'COMPETITIVE_SOURCING',
                'PURCHASE_ORDER_CONTROL',
                'CONTRACT_CONTROL',
                'RISK_REVIEW',
                'MULTI_CONTROL'
            )
        )
);

CREATE INDEX idx_guided_templates_active
    ON guided_buying_templates (
        active,
        category
    );

CREATE INDEX idx_preferred_supplier_category
    ON preferred_supplier_categories (
        LOWER(category),
        active,
        preference_rank
    );

CREATE INDEX idx_guided_intakes_status
    ON guided_buying_intakes (
        status,
        created_at DESC
    );

CREATE INDEX idx_guided_intakes_department
    ON guided_buying_intakes (
        department_id,
        status
    );

CREATE INDEX idx_guided_intakes_category
    ON guided_buying_intakes (
        category,
        status
    );

CREATE INDEX idx_guided_intakes_requester
    ON guided_buying_intakes (
        requester_user_id,
        status
    );

CREATE TRIGGER trg_audit_guided_buying_templates
AFTER INSERT OR UPDATE OR DELETE
ON guided_buying_templates
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_preferred_supplier_categories
AFTER INSERT OR UPDATE OR DELETE
ON preferred_supplier_categories
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_guided_buying_intakes
AFTER INSERT OR UPDATE OR DELETE
ON guided_buying_intakes
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
