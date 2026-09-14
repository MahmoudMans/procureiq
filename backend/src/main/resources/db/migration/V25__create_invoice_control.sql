CREATE SEQUENCE procurement_invoice_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_invoices (
    id UUID PRIMARY KEY,

    invoice_number
        VARCHAR(50)
        NOT NULL,

    supplier_invoice_number
        VARCHAR(120)
        NOT NULL,

    supplier_id
        UUID
        NOT NULL,

    purchase_order_id
        UUID
        NOT NULL,

    invoice_date
        DATE
        NOT NULL,

    due_date
        DATE
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    subtotal_amount
        NUMERIC(19, 2)
        NOT NULL,

    tax_amount
        NUMERIC(19, 2)
        NOT NULL,

    total_amount
        NUMERIC(19, 2)
        NOT NULL,

    po_variance_tolerance_pct
        NUMERIC(9, 4)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    match_status
        VARCHAR(20)
        NOT NULL,

    payment_hold
        BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    hold_reason
        VARCHAR(2000),

    approved_by_user_id
        UUID,

    approved_at
        TIMESTAMPTZ,

    ready_for_payment_at
        TIMESTAMPTZ,

    paid_at
        TIMESTAMPTZ,

    created_by_user_id
        UUID
        NOT NULL,

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

    CONSTRAINT uk_procurement_invoice_number
        UNIQUE (
            invoice_number
        ),

    CONSTRAINT fk_invoice_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id),

    CONSTRAINT fk_invoice_purchase_order
        FOREIGN KEY (
            purchase_order_id
        )
        REFERENCES purchase_orders (id),

    CONSTRAINT fk_invoice_approver
        FOREIGN KEY (
            approved_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_invoice_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_invoice_currency
        CHECK (
            CHAR_LENGTH(currency) = 3
        ),

    CONSTRAINT ck_invoice_subtotal
        CHECK (
            subtotal_amount >= 0
        ),

    CONSTRAINT ck_invoice_tax
        CHECK (
            tax_amount >= 0
        ),

    CONSTRAINT ck_invoice_total
        CHECK (
            total_amount >= 0
        ),

    CONSTRAINT ck_invoice_variance_tolerance
        CHECK (
            po_variance_tolerance_pct
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_invoice_status
        CHECK (
            status IN (
                'MATCH_PENDING',
                'MATCHED',
                'EXCEPTION',
                'APPROVED',
                'PAYMENT_HOLD',
                'READY_FOR_PAYMENT',
                'PAID',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_invoice_match_status
        CHECK (
            match_status IN (
                'NOT_RUN',
                'MATCHED',
                'EXCEPTION'
            )
        )
);

CREATE TABLE procurement_invoice_lines (
    id UUID PRIMARY KEY,

    invoice_id
        UUID
        NOT NULL,

    line_number
        INTEGER
        NOT NULL,

    description
        VARCHAR(500)
        NOT NULL,

    quantity
        NUMERIC(19, 4)
        NOT NULL,

    unit_price
        NUMERIC(19, 4)
        NOT NULL,

    line_total
        NUMERIC(19, 2)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_invoice_line_invoice
        FOREIGN KEY (
            invoice_id
        )
        REFERENCES procurement_invoices (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_invoice_line_number
        UNIQUE (
            invoice_id,
            line_number
        ),

    CONSTRAINT ck_invoice_line_number
        CHECK (
            line_number >= 1
        ),

    CONSTRAINT ck_invoice_line_quantity
        CHECK (
            quantity > 0
        ),

    CONSTRAINT ck_invoice_line_unit_price
        CHECK (
            unit_price >= 0
        ),

    CONSTRAINT ck_invoice_line_total
        CHECK (
            line_total >= 0
        )
);

CREATE TABLE invoice_match_exceptions (
    id UUID PRIMARY KEY,

    invoice_id
        UUID
        NOT NULL,

    exception_key
        VARCHAR(255)
        NOT NULL,

    exception_type
        VARCHAR(50)
        NOT NULL,

    severity
        VARCHAR(20)
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    expected_value
        NUMERIC(19, 2),

    actual_value
        NUMERIC(19, 2),

    variance_amount
        NUMERIC(19, 2),

    details
        VARCHAR(3000)
        NOT NULL,

    detected_at
        TIMESTAMPTZ
        NOT NULL,

    last_checked_at
        TIMESTAMPTZ
        NOT NULL,

    resolved_by_user_id
        UUID,

    resolution_note
        VARCHAR(2000),

    resolved_at
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

    CONSTRAINT uk_invoice_exception_key
        UNIQUE (
            exception_key
        ),

    CONSTRAINT fk_invoice_exception_invoice
        FOREIGN KEY (
            invoice_id
        )
        REFERENCES procurement_invoices (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_invoice_exception_resolver
        FOREIGN KEY (
            resolved_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_invoice_exception_type
        CHECK (
            exception_type IN (
                'DUPLICATE_INVOICE',
                'CURRENCY_MISMATCH',
                'PO_CANCELLED',
                'RECEIPT_INCOMPLETE',
                'OVER_INVOICE'
            )
        ),

    CONSTRAINT ck_invoice_exception_severity
        CHECK (
            severity IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_invoice_exception_status
        CHECK (
            status IN (
                'OPEN',
                'RESOLVED',
                'DISMISSED'
            )
        )
);

CREATE INDEX idx_procurement_invoice_status
    ON procurement_invoices (
        status,
        due_date
    );

CREATE INDEX idx_procurement_invoice_supplier
    ON procurement_invoices (
        supplier_id,
        supplier_invoice_number
    );

CREATE INDEX idx_procurement_invoice_po
    ON procurement_invoices (
        purchase_order_id,
        status
    );

CREATE INDEX idx_invoice_exception_invoice
    ON invoice_match_exceptions (
        invoice_id,
        status
    );

CREATE INDEX idx_invoice_exception_status
    ON invoice_match_exceptions (
        status,
        severity,
        detected_at DESC
    );

CREATE TRIGGER trg_audit_procurement_invoices
AFTER INSERT OR UPDATE OR DELETE
ON procurement_invoices
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_invoice_lines
AFTER INSERT OR UPDATE OR DELETE
ON procurement_invoice_lines
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_invoice_match_exceptions
AFTER INSERT OR UPDATE OR DELETE
ON invoice_match_exceptions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
