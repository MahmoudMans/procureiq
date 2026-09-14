CREATE SEQUENCE quotation_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE quotations (
    id UUID PRIMARY KEY,

    quotation_number
        VARCHAR(40)
        NOT NULL,

    rfq_id
        UUID
        NOT NULL,

    supplier_id
        UUID
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    lead_time_days
        INTEGER
        NOT NULL,

    payment_terms
        VARCHAR(300)
        NOT NULL,

    validity_date
        DATE
        NOT NULL,

    subtotal
        NUMERIC(19, 2)
        NOT NULL,

    discount_amount
        NUMERIC(19, 2)
        NOT NULL
        DEFAULT 0,

    shipping_amount
        NUMERIC(19, 2)
        NOT NULL
        DEFAULT 0,

    tax_amount
        NUMERIC(19, 2)
        NOT NULL
        DEFAULT 0,

    total_amount
        NUMERIC(19, 2)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    recorded_by_user_id
        UUID
        NOT NULL,

    submitted_at
        TIMESTAMPTZ,

    withdrawn_at
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

    CONSTRAINT uk_quotations_number
        UNIQUE (
            quotation_number
        ),

    CONSTRAINT uk_quotations_rfq_supplier
        UNIQUE (
            rfq_id,
            supplier_id
        ),

    CONSTRAINT fk_quotations_rfq
        FOREIGN KEY (
            rfq_id
        )
        REFERENCES rfqs (id),

    CONSTRAINT fk_quotations_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id),

    CONSTRAINT fk_quotations_recorded_by
        FOREIGN KEY (
            recorded_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_quotations_status
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'WITHDRAWN'
            )
        ),

    CONSTRAINT ck_quotations_lead_time
        CHECK (
            lead_time_days >= 0
        ),

    CONSTRAINT ck_quotations_subtotal
        CHECK (
            subtotal >= 0
        ),

    CONSTRAINT ck_quotations_discount
        CHECK (
            discount_amount >= 0
        ),

    CONSTRAINT ck_quotations_shipping
        CHECK (
            shipping_amount >= 0
        ),

    CONSTRAINT ck_quotations_tax
        CHECK (
            tax_amount >= 0
        ),

    CONSTRAINT ck_quotations_total
        CHECK (
            total_amount >= 0
        )
);

CREATE TABLE quotation_lines (
    id UUID PRIMARY KEY,

    quotation_id
        UUID
        NOT NULL,

    rfq_line_item_id
        UUID
        NOT NULL,

    line_number
        INTEGER
        NOT NULL,

    quantity
        NUMERIC(14, 3)
        NOT NULL,

    unit
        VARCHAR(30)
        NOT NULL,

    unit_price
        NUMERIC(19, 2)
        NOT NULL,

    line_subtotal
        NUMERIC(19, 2)
        NOT NULL,

    CONSTRAINT fk_quotation_lines_quotation
        FOREIGN KEY (
            quotation_id
        )
        REFERENCES quotations (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_quotation_lines_rfq_line
        FOREIGN KEY (
            rfq_line_item_id
        )
        REFERENCES rfq_line_items (id),

    CONSTRAINT uk_quotation_line_number
        UNIQUE (
            quotation_id,
            line_number
        ),

    CONSTRAINT uk_quotation_rfq_line
        UNIQUE (
            quotation_id,
            rfq_line_item_id
        ),

    CONSTRAINT ck_quotation_line_quantity
        CHECK (
            quantity > 0
        ),

    CONSTRAINT ck_quotation_line_unit_price
        CHECK (
            unit_price >= 0
        ),

    CONSTRAINT ck_quotation_line_subtotal
        CHECK (
            line_subtotal >= 0
        )
);

CREATE INDEX idx_quotations_rfq
    ON quotations (
        rfq_id
    );

CREATE INDEX idx_quotations_supplier
    ON quotations (
        supplier_id
    );

CREATE INDEX idx_quotations_status
    ON quotations (
        status
    );

CREATE INDEX idx_quotations_total
    ON quotations (
        total_amount
    );

CREATE INDEX idx_quotation_lines_quotation
    ON quotation_lines (
        quotation_id
    );

CREATE INDEX idx_quotation_lines_rfq_line
    ON quotation_lines (
        rfq_line_item_id
    );
