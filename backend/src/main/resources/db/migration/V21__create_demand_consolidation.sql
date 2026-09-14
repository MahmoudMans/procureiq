CREATE SEQUENCE demand_consolidation_bundle_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE demand_consolidation_bundles (
    id UUID PRIMARY KEY,

    bundle_number
        VARCHAR(50)
        NOT NULL,

    title
        VARCHAR(220)
        NOT NULL,

    category
        VARCHAR(120)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    target_sourcing_date
        DATE
        NOT NULL,

    consolidated_value
        NUMERIC(19, 2)
        NOT NULL,

    expected_leverage_pct
        NUMERIC(5, 2)
        NOT NULL,

    expected_savings
        NUMERIC(19, 2)
        NOT NULL,

    intake_count
        INTEGER
        NOT NULL,

    department_count
        INTEGER
        NOT NULL,

    owner_user_id
        UUID
        NOT NULL,

    rationale
        VARCHAR(3000),

    decision_note
        VARCHAR(2000),

    decided_by_user_id
        UUID,

    decided_at
        TIMESTAMPTZ,

    linked_rfq_id
        UUID,

    sourcing_started_at
        TIMESTAMPTZ,

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

    CONSTRAINT uk_demand_consolidation_bundle_number
        UNIQUE (
            bundle_number
        ),

    CONSTRAINT fk_demand_bundle_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_demand_bundle_decider
        FOREIGN KEY (
            decided_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_demand_bundle_rfq
        FOREIGN KEY (
            linked_rfq_id
        )
        REFERENCES rfqs (id)
        ON DELETE SET NULL,

    CONSTRAINT ck_demand_bundle_currency
        CHECK (
            CHAR_LENGTH(
                currency
            ) = 3
        ),

    CONSTRAINT ck_demand_bundle_status
        CHECK (
            status IN (
                'DRAFT',
                'UNDER_REVIEW',
                'APPROVED',
                'SOURCING',
                'CLOSED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_demand_bundle_value
        CHECK (
            consolidated_value >= 0
        ),

    CONSTRAINT ck_demand_bundle_leverage
        CHECK (
            expected_leverage_pct
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_demand_bundle_savings
        CHECK (
            expected_savings >= 0
        ),

    CONSTRAINT ck_demand_bundle_intakes
        CHECK (
            intake_count >= 2
        ),

    CONSTRAINT ck_demand_bundle_departments
        CHECK (
            department_count >= 2
        )
);

CREATE TABLE demand_consolidation_bundle_items (
    id UUID PRIMARY KEY,

    bundle_id
        UUID
        NOT NULL,

    guided_buying_intake_id
        UUID
        NOT NULL,

    department_id
        UUID
        NOT NULL,

    estimated_amount
        NUMERIC(19, 2)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_demand_bundle_item_bundle
        FOREIGN KEY (
            bundle_id
        )
        REFERENCES demand_consolidation_bundles (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_demand_bundle_item_intake
        FOREIGN KEY (
            guided_buying_intake_id
        )
        REFERENCES guided_buying_intakes (id),

    CONSTRAINT fk_demand_bundle_item_department
        FOREIGN KEY (
            department_id
        )
        REFERENCES departments (id),

    CONSTRAINT uk_demand_bundle_intake_pair
        UNIQUE (
            bundle_id,
            guided_buying_intake_id
        ),

    CONSTRAINT ck_demand_bundle_item_amount
        CHECK (
            estimated_amount >= 0
        )
);

CREATE INDEX idx_demand_bundle_status
    ON demand_consolidation_bundles (
        status,
        target_sourcing_date
    );

CREATE INDEX idx_demand_bundle_category
    ON demand_consolidation_bundles (
        LOWER(category),
        currency,
        status
    );

CREATE INDEX idx_demand_bundle_owner
    ON demand_consolidation_bundles (
        owner_user_id,
        status
    );

CREATE INDEX idx_demand_bundle_item_intake
    ON demand_consolidation_bundle_items (
        guided_buying_intake_id
    );

CREATE INDEX idx_demand_bundle_item_bundle
    ON demand_consolidation_bundle_items (
        bundle_id
    );

CREATE TRIGGER trg_audit_demand_consolidation_bundles
AFTER INSERT OR UPDATE OR DELETE
ON demand_consolidation_bundles
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_demand_consolidation_bundle_items
AFTER INSERT OR UPDATE OR DELETE
ON demand_consolidation_bundle_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
