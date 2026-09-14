CREATE SEQUENCE procurement_plan_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_plans (
    id UUID PRIMARY KEY,

    plan_number
        VARCHAR(40)
        NOT NULL,

    name
        VARCHAR(220)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    owner_user_id
        UUID
        NOT NULL,

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

    CONSTRAINT uk_procurement_plan_number
        UNIQUE (
            plan_number
        ),

    CONSTRAINT fk_procurement_plan_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_procurement_plan_year
        CHECK (
            fiscal_year BETWEEN 2000 AND 2200
        ),

    CONSTRAINT ck_procurement_plan_status
        CHECK (
            status IN (
                'DRAFT',
                'ACTIVE',
                'CLOSED',
                'ARCHIVED'
            )
        )
);

CREATE TABLE procurement_plan_items (
    id UUID PRIMARY KEY,

    plan_id
        UUID
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

    planned_value
        NUMERIC(19, 2)
        NOT NULL,

    target_sourcing_date
        DATE
        NOT NULL,

    priority
        VARCHAR(30)
        NOT NULL,

    status
        VARCHAR(40)
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

    CONSTRAINT fk_plan_item_plan
        FOREIGN KEY (
            plan_id
        )
        REFERENCES procurement_plans (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_plan_item_department
        FOREIGN KEY (
            department_id
        )
        REFERENCES departments (id),

    CONSTRAINT fk_plan_item_request
        FOREIGN KEY (
            linked_purchase_request_id
        )
        REFERENCES purchase_requests (id)
        ON DELETE SET NULL,

    CONSTRAINT uk_plan_item_request
        UNIQUE (
            linked_purchase_request_id
        ),

    CONSTRAINT ck_plan_item_value
        CHECK (
            planned_value > 0
        ),

    CONSTRAINT ck_plan_item_priority
        CHECK (
            priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_plan_item_status
        CHECK (
            status IN (
                'PLANNED',
                'READY',
                'CONVERTED',
                'COMPLETED',
                'CANCELLED'
            )
        )
);

CREATE INDEX idx_procurement_plans_year
    ON procurement_plans (
        fiscal_year,
        currency,
        status
    );

CREATE INDEX idx_plan_items_plan
    ON procurement_plan_items (
        plan_id,
        status
    );

CREATE INDEX idx_plan_items_target
    ON procurement_plan_items (
        target_sourcing_date,
        status
    );

CREATE INDEX idx_plan_items_department
    ON procurement_plan_items (
        department_id
    );

CREATE INDEX idx_plan_items_category
    ON procurement_plan_items (
        category
    );

CREATE TRIGGER trg_audit_procurement_plans
AFTER INSERT OR UPDATE OR DELETE
ON procurement_plans
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_plan_items
AFTER INSERT OR UPDATE OR DELETE
ON procurement_plan_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
