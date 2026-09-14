CREATE SEQUENCE rfq_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE rfqs (
    id UUID PRIMARY KEY,

    rfq_number
        VARCHAR(40)
        NOT NULL,

    source_purchase_request_id
        UUID
        NOT NULL,

    title
        VARCHAR(200)
        NOT NULL,

    description
        VARCHAR(3000),

    currency
        VARCHAR(3)
        NOT NULL,

    response_deadline
        TIMESTAMP
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    created_by_user_id
        UUID
        NOT NULL,

    published_at
        TIMESTAMPTZ,

    closed_at
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

    CONSTRAINT uk_rfqs_number
        UNIQUE (rfq_number),

    CONSTRAINT uk_rfqs_purchase_request
        UNIQUE (
            source_purchase_request_id
        ),

    CONSTRAINT fk_rfqs_purchase_request
        FOREIGN KEY (
            source_purchase_request_id
        )
        REFERENCES purchase_requests (id),

    CONSTRAINT fk_rfqs_created_by
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_rfqs_status
        CHECK (
            status IN (
                'DRAFT',
                'PUBLISHED',
                'CLOSED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_rfqs_currency
        CHECK (
            char_length(currency) = 3
        )
);

CREATE TABLE rfq_line_items (
    id UUID PRIMARY KEY,

    rfq_id
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

    CONSTRAINT fk_rfq_lines_rfq
        FOREIGN KEY (
            rfq_id
        )
        REFERENCES rfqs (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_rfq_line_number
        UNIQUE (
            rfq_id,
            line_number
        ),

    CONSTRAINT ck_rfq_line_quantity
        CHECK (
            quantity > 0
        )
);

CREATE TABLE rfq_supplier_invitations (
    id UUID PRIMARY KEY,

    rfq_id
        UUID
        NOT NULL,

    supplier_id
        UUID
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    invited_at
        TIMESTAMPTZ
        NOT NULL,

    responded_at
        TIMESTAMPTZ,

    CONSTRAINT fk_rfq_invitation_rfq
        FOREIGN KEY (
            rfq_id
        )
        REFERENCES rfqs (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_rfq_invitation_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id),

    CONSTRAINT uk_rfq_supplier_invitation
        UNIQUE (
            rfq_id,
            supplier_id
        ),

    CONSTRAINT ck_rfq_invitation_status
        CHECK (
            status IN (
                'INVITED',
                'RESPONDED',
                'DECLINED'
            )
        )
);

CREATE INDEX idx_rfqs_status
    ON rfqs (status);

CREATE INDEX idx_rfqs_updated
    ON rfqs (
        updated_at DESC
    );

CREATE INDEX idx_rfqs_deadline
    ON rfqs (
        response_deadline
    );

CREATE INDEX idx_rfq_lines_rfq
    ON rfq_line_items (
        rfq_id
    );

CREATE INDEX idx_rfq_invitations_rfq
    ON rfq_supplier_invitations (
        rfq_id
    );

CREATE INDEX idx_rfq_invitations_supplier
    ON rfq_supplier_invitations (
        supplier_id
    );

CREATE INDEX idx_rfq_invitations_status
    ON rfq_supplier_invitations (
        status
    );
