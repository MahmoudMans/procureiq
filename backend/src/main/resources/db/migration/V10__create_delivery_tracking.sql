ALTER TABLE purchase_orders
    DROP CONSTRAINT ck_purchase_orders_status;

ALTER TABLE purchase_orders
    ADD CONSTRAINT ck_purchase_orders_status
    CHECK (
        status IN (
            'DRAFT',
            'ISSUED',
            'PARTIALLY_RECEIVED',
            'RECEIVED',
            'CANCELLED'
        )
    );

CREATE SEQUENCE goods_receipt_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE goods_receipts (
    id UUID PRIMARY KEY,

    receipt_number
        VARCHAR(40)
        NOT NULL,

    purchase_order_id
        UUID
        NOT NULL,

    received_date
        DATE
        NOT NULL,

    delivery_reference
        VARCHAR(160),

    notes
        VARCHAR(2000),

    recorded_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_goods_receipts_number
        UNIQUE (
            receipt_number
        ),

    CONSTRAINT fk_goods_receipts_po
        FOREIGN KEY (
            purchase_order_id
        )
        REFERENCES purchase_orders (id),

    CONSTRAINT fk_goods_receipts_user
        FOREIGN KEY (
            recorded_by_user_id
        )
        REFERENCES app_users (id)
);

CREATE TABLE goods_receipt_lines (
    id UUID PRIMARY KEY,

    goods_receipt_id
        UUID
        NOT NULL,

    purchase_order_line_id
        UUID
        NOT NULL,

    quantity_received
        NUMERIC(14, 3)
        NOT NULL,

    CONSTRAINT fk_goods_receipt_lines_receipt
        FOREIGN KEY (
            goods_receipt_id
        )
        REFERENCES goods_receipts (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_goods_receipt_lines_po_line
        FOREIGN KEY (
            purchase_order_line_id
        )
        REFERENCES purchase_order_lines (id),

    CONSTRAINT uk_goods_receipt_line
        UNIQUE (
            goods_receipt_id,
            purchase_order_line_id
        ),

    CONSTRAINT ck_goods_receipt_quantity
        CHECK (
            quantity_received > 0
        )
);

CREATE TABLE supplier_delivery_performance (
    id UUID PRIMARY KEY,

    supplier_id
        UUID
        NOT NULL,

    tracked_orders
        BIGINT
        NOT NULL,

    completed_orders
        BIGINT
        NOT NULL,

    on_time_orders
        BIGINT
        NOT NULL,

    late_orders
        BIGINT
        NOT NULL,

    ordered_quantity
        NUMERIC(19, 3)
        NOT NULL,

    received_quantity
        NUMERIC(19, 3)
        NOT NULL,

    on_time_delivery_rate
        NUMERIC(5, 2)
        NOT NULL,

    fulfillment_rate
        NUMERIC(5, 2)
        NOT NULL,

    last_receipt_date
        DATE,

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_supplier_delivery_performance
        UNIQUE (
            supplier_id
        ),

    CONSTRAINT fk_supplier_delivery_performance_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id),

    CONSTRAINT ck_supplier_delivery_performance_rates
        CHECK (
            on_time_delivery_rate >= 0
            AND on_time_delivery_rate <= 100
            AND fulfillment_rate >= 0
            AND fulfillment_rate <= 100
        )
);

CREATE INDEX idx_goods_receipts_po
    ON goods_receipts (
        purchase_order_id
    );

CREATE INDEX idx_goods_receipts_date
    ON goods_receipts (
        received_date DESC
    );

CREATE INDEX idx_goods_receipt_lines_po_line
    ON goods_receipt_lines (
        purchase_order_line_id
    );
