CREATE SEQUENCE procurement_savings_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_savings_initiatives (
    id UUID PRIMARY KEY,

    savings_number VARCHAR(40) NOT NULL,
    source_key VARCHAR(255),

    origin VARCHAR(30) NOT NULL,
    title VARCHAR(220) NOT NULL,
    savings_type VARCHAR(40) NOT NULL,
    status VARCHAR(40) NOT NULL,

    fiscal_year INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    category VARCHAR(120),

    rfq_id UUID,
    supplier_id UUID,
    purchase_order_id UUID,

    baseline_value NUMERIC(19, 2) NOT NULL,
    negotiated_value NUMERIC(19, 2) NOT NULL,
    target_savings NUMERIC(19, 2) NOT NULL,
    realized_savings NUMERIC(19, 2) NOT NULL DEFAULT 0,

    owner_user_id UUID NOT NULL,

    decided_by_user_id UUID,
    decision_note VARCHAR(2000),
    decision_at TIMESTAMPTZ,

    notes VARCHAR(2000),

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT uk_procurement_savings_number
        UNIQUE (savings_number),

    CONSTRAINT uk_procurement_savings_source
        UNIQUE (source_key),

    CONSTRAINT fk_savings_rfq
        FOREIGN KEY (rfq_id)
        REFERENCES rfqs (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_savings_supplier
        FOREIGN KEY (supplier_id)
        REFERENCES suppliers (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_savings_po
        FOREIGN KEY (purchase_order_id)
        REFERENCES purchase_orders (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_savings_owner
        FOREIGN KEY (owner_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_savings_decided_by
        FOREIGN KEY (decided_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_savings_origin
        CHECK (
            origin IN (
                'MANUAL',
                'SYSTEM'
            )
        ),

    CONSTRAINT ck_savings_type
        CHECK (
            savings_type IN (
                'HARD_SAVINGS',
                'COST_AVOIDANCE'
            )
        ),

    CONSTRAINT ck_savings_status
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'VALIDATED',
                'REJECTED',
                'CLOSED'
            )
        ),

    CONSTRAINT ck_savings_year
        CHECK (
            fiscal_year BETWEEN 2000 AND 2200
        ),

    CONSTRAINT ck_savings_baseline
        CHECK (
            baseline_value >= 0
        ),

    CONSTRAINT ck_savings_negotiated
        CHECK (
            negotiated_value >= 0
        ),

    CONSTRAINT ck_savings_target
        CHECK (
            target_savings >= 0
        ),

    CONSTRAINT ck_savings_realized
        CHECK (
            realized_savings >= 0
        )
);

CREATE TABLE procurement_savings_realizations (
    id UUID PRIMARY KEY,

    initiative_id UUID NOT NULL,

    source_key VARCHAR(255),
    source_type VARCHAR(30) NOT NULL,

    purchase_order_id UUID,

    realization_date DATE NOT NULL,
    amount NUMERIC(19, 2) NOT NULL,

    notes VARCHAR(2000),

    created_by_user_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_savings_realization_initiative
        FOREIGN KEY (initiative_id)
        REFERENCES procurement_savings_initiatives (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_savings_realization_po
        FOREIGN KEY (purchase_order_id)
        REFERENCES purchase_orders (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_savings_realization_created_by
        FOREIGN KEY (created_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT uk_savings_realization_source
        UNIQUE (source_key),

    CONSTRAINT ck_savings_realization_source_type
        CHECK (
            source_type IN (
                'MANUAL',
                'PURCHASE_ORDER'
            )
        ),

    CONSTRAINT ck_savings_realization_amount
        CHECK (
            amount >= 0
        )
);

CREATE INDEX idx_savings_initiatives_year
    ON procurement_savings_initiatives (
        fiscal_year,
        currency,
        status
    );

CREATE INDEX idx_savings_initiatives_supplier
    ON procurement_savings_initiatives (
        supplier_id,
        status
    );

CREATE INDEX idx_savings_initiatives_rfq
    ON procurement_savings_initiatives (
        rfq_id
    );

CREATE INDEX idx_savings_initiatives_owner
    ON procurement_savings_initiatives (
        owner_user_id,
        status
    );

CREATE INDEX idx_savings_realizations_initiative
    ON procurement_savings_realizations (
        initiative_id,
        realization_date
    );

CREATE INDEX idx_savings_realizations_date
    ON procurement_savings_realizations (
        realization_date
    );

CREATE TRIGGER trg_audit_procurement_savings_initiatives
AFTER INSERT OR UPDATE OR DELETE
ON procurement_savings_initiatives
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_savings_realizations
AFTER INSERT OR UPDATE OR DELETE
ON procurement_savings_realizations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
