CREATE SEQUENCE purchase_order_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY,

    po_number
        VARCHAR(40)
        NOT NULL,

    rfq_id
        UUID
        NOT NULL,

    award_decision_id
        UUID
        NOT NULL,

    quotation_id
        UUID
        NOT NULL,

    supplier_id
        UUID
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    payment_terms
        VARCHAR(300)
        NOT NULL,

    expected_delivery_date
        DATE
        NOT NULL,

    delivery_address
        VARCHAR(1000)
        NOT NULL,

    buyer_notes
        VARCHAR(2000),

    subtotal
        NUMERIC(19, 2)
        NOT NULL,

    discount_amount
        NUMERIC(19, 2)
        NOT NULL,

    shipping_amount
        NUMERIC(19, 2)
        NOT NULL,

    tax_amount
        NUMERIC(19, 2)
        NOT NULL,

    total_amount
        NUMERIC(19, 2)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    created_by_user_id
        UUID
        NOT NULL,

    issued_by_user_id
        UUID,

    issued_at
        TIMESTAMPTZ,

    cancelled_at
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

    CONSTRAINT uk_purchase_orders_number
        UNIQUE (
            po_number
        ),

    CONSTRAINT uk_purchase_orders_rfq
        UNIQUE (
            rfq_id
        ),

    CONSTRAINT uk_purchase_orders_award
        UNIQUE (
            award_decision_id
        ),

    CONSTRAINT fk_purchase_orders_rfq
        FOREIGN KEY (
            rfq_id
        )
        REFERENCES rfqs (id),

    CONSTRAINT fk_purchase_orders_award
        FOREIGN KEY (
            award_decision_id
        )
        REFERENCES award_decisions (id),

    CONSTRAINT fk_purchase_orders_quotation
        FOREIGN KEY (
            quotation_id
        )
        REFERENCES quotations (id),

    CONSTRAINT fk_purchase_orders_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id),

    CONSTRAINT fk_purchase_orders_created_by
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_purchase_orders_issued_by
        FOREIGN KEY (
            issued_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_purchase_orders_status
        CHECK (
            status IN (
                'DRAFT',
                'ISSUED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_purchase_orders_subtotal
        CHECK (
            subtotal >= 0
        ),

    CONSTRAINT ck_purchase_orders_discount
        CHECK (
            discount_amount >= 0
        ),

    CONSTRAINT ck_purchase_orders_shipping
        CHECK (
            shipping_amount >= 0
        ),

    CONSTRAINT ck_purchase_orders_tax
        CHECK (
            tax_amount >= 0
        ),

    CONSTRAINT ck_purchase_orders_total
        CHECK (
            total_amount >= 0
        )
);

CREATE TABLE purchase_order_lines (
    id UUID PRIMARY KEY,

    purchase_order_id
        UUID
        NOT NULL,

    line_number
        INTEGER
        NOT NULL,

    item_name
        VARCHAR(180)
        NOT NULL,

    description
        VARCHAR(1000),

    category
        VARCHAR(120)
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

    line_total
        NUMERIC(19, 2)
        NOT NULL,

    CONSTRAINT fk_purchase_order_lines_order
        FOREIGN KEY (
            purchase_order_id
        )
        REFERENCES purchase_orders (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_purchase_order_line
        UNIQUE (
            purchase_order_id,
            line_number
        ),

    CONSTRAINT ck_purchase_order_line_quantity
        CHECK (
            quantity > 0
        ),

    CONSTRAINT ck_purchase_order_line_price
        CHECK (
            unit_price >= 0
        ),

    CONSTRAINT ck_purchase_order_line_total
        CHECK (
            line_total >= 0
        )
);

CREATE INDEX idx_purchase_orders_supplier
    ON purchase_orders (
        supplier_id
    );

CREATE INDEX idx_purchase_orders_status
    ON purchase_orders (
        status
    );

CREATE INDEX idx_purchase_orders_expected_delivery
    ON purchase_orders (
        expected_delivery_date
    );

CREATE INDEX idx_purchase_orders_updated
    ON purchase_orders (
        updated_at DESC
    );

CREATE INDEX idx_purchase_order_lines_order
    ON purchase_order_lines (
        purchase_order_id
    );
