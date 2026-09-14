CREATE TABLE budget_allocations (
    id UUID PRIMARY KEY,

    fiscal_year
        INTEGER
        NOT NULL,

    scope_type
        VARCHAR(30)
        NOT NULL,

    department_id
        UUID,

    category
        VARCHAR(120),

    currency
        VARCHAR(3)
        NOT NULL,

    budget_amount
        NUMERIC(19, 2)
        NOT NULL,

    warning_threshold_percent
        NUMERIC(5, 2)
        NOT NULL,

    hard_limit
        BOOLEAN
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

    CONSTRAINT fk_budget_department
        FOREIGN KEY (
            department_id
        )
        REFERENCES departments (id),

    CONSTRAINT fk_budget_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_budget_scope
        CHECK (
            scope_type IN (
                'DEPARTMENT',
                'CATEGORY'
            )
        ),

    CONSTRAINT ck_budget_status
        CHECK (
            status IN (
                'ACTIVE',
                'ARCHIVED'
            )
        ),

    CONSTRAINT ck_budget_fiscal_year
        CHECK (
            fiscal_year BETWEEN 2000 AND 2200
        ),

    CONSTRAINT ck_budget_amount
        CHECK (
            budget_amount > 0
        ),

    CONSTRAINT ck_budget_warning_threshold
        CHECK (
            warning_threshold_percent > 0
            AND warning_threshold_percent <= 100
        ),

    CONSTRAINT ck_budget_scope_value
        CHECK (
            (
                scope_type = 'DEPARTMENT'
                AND department_id IS NOT NULL
                AND category IS NULL
            )
            OR
            (
                scope_type = 'CATEGORY'
                AND department_id IS NULL
                AND category IS NOT NULL
            )
        )
);

CREATE UNIQUE INDEX uk_active_department_budget
    ON budget_allocations (
        fiscal_year,
        department_id,
        currency
    )
    WHERE
        scope_type = 'DEPARTMENT'
        AND status = 'ACTIVE';

CREATE UNIQUE INDEX uk_active_category_budget
    ON budget_allocations (
        fiscal_year,
        LOWER(category),
        currency
    )
    WHERE
        scope_type = 'CATEGORY'
        AND status = 'ACTIVE';

CREATE INDEX idx_budget_allocations_year
    ON budget_allocations (
        fiscal_year,
        currency,
        status
    );

CREATE INDEX idx_budget_allocations_department
    ON budget_allocations (
        department_id
    );

CREATE INDEX idx_budget_allocations_category
    ON budget_allocations (
        category
    );

CREATE TRIGGER trg_audit_budget_allocations
AFTER INSERT OR UPDATE OR DELETE
ON budget_allocations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
