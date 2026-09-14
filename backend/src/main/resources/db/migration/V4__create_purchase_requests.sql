CREATE SEQUENCE purchase_request_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE purchase_requests (
    id UUID PRIMARY KEY,

    request_number VARCHAR(40) NOT NULL,

    title VARCHAR(200) NOT NULL,

    description VARCHAR(2000),

    business_justification VARCHAR(3000) NOT NULL,

    requester_id UUID NOT NULL,

    department_id UUID NOT NULL,

    cost_center VARCHAR(80) NOT NULL,

    currency VARCHAR(3) NOT NULL,

    desired_delivery_date DATE NOT NULL,

    status VARCHAR(30) NOT NULL,

    estimated_total_amount
        NUMERIC(19, 2)
        NOT NULL
        DEFAULT 0,

    submitted_at TIMESTAMPTZ,

    cancelled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL,

    updated_at TIMESTAMPTZ NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT uk_purchase_requests_number
        UNIQUE (request_number),

    CONSTRAINT fk_purchase_requests_requester
        FOREIGN KEY (requester_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_purchase_requests_department
        FOREIGN KEY (department_id)
        REFERENCES departments (id),

    CONSTRAINT ck_purchase_requests_status
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'APPROVED',
                'REJECTED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_purchase_requests_currency
        CHECK (
            char_length(currency) = 3
        ),

    CONSTRAINT ck_purchase_requests_total
        CHECK (
            estimated_total_amount >= 0
        )
);

CREATE TABLE purchase_request_items (
    id UUID PRIMARY KEY,

    purchase_request_id UUID NOT NULL,

    line_number INTEGER NOT NULL,

    item_name VARCHAR(180) NOT NULL,

    description VARCHAR(1000),

    category VARCHAR(120) NOT NULL,

    quantity NUMERIC(14, 3) NOT NULL,

    unit VARCHAR(30) NOT NULL,

    estimated_unit_price
        NUMERIC(19, 2)
        NOT NULL,

    estimated_line_total
        NUMERIC(19, 2)
        NOT NULL,

    CONSTRAINT fk_purchase_request_items_request
        FOREIGN KEY (purchase_request_id)
        REFERENCES purchase_requests (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_purchase_request_line
        UNIQUE (
            purchase_request_id,
            line_number
        ),

    CONSTRAINT ck_purchase_request_item_quantity
        CHECK (
            quantity > 0
        ),

    CONSTRAINT ck_purchase_request_item_price
        CHECK (
            estimated_unit_price >= 0
        ),

    CONSTRAINT ck_purchase_request_item_total
        CHECK (
            estimated_line_total >= 0
        )
);

CREATE INDEX idx_purchase_requests_requester
    ON purchase_requests (requester_id);

CREATE INDEX idx_purchase_requests_department
    ON purchase_requests (department_id);

CREATE INDEX idx_purchase_requests_status
    ON purchase_requests (status);

CREATE INDEX idx_purchase_requests_updated
    ON purchase_requests (updated_at DESC);

CREATE INDEX idx_purchase_requests_cost_center
    ON purchase_requests (cost_center);

CREATE INDEX idx_purchase_request_items_request
    ON purchase_request_items (
        purchase_request_id
    );

CREATE INDEX idx_purchase_request_items_category
    ON purchase_request_items (
        category
    );
