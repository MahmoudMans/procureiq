CREATE SEQUENCE supplier_contract_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE supplier_contracts (
    id UUID PRIMARY KEY,

    contract_number
        VARCHAR(40)
        NOT NULL,

    supplier_id
        UUID
        NOT NULL,

    title
        VARCHAR(200)
        NOT NULL,

    contract_type
        VARCHAR(100)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    start_date
        DATE
        NOT NULL,

    end_date
        DATE
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    contract_value
        NUMERIC(19, 2)
        NOT NULL,

    auto_renew
        BOOLEAN
        NOT NULL,

    notice_period_days
        INTEGER
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

    CONSTRAINT uk_supplier_contract_number
        UNIQUE (
            contract_number
        ),

    CONSTRAINT fk_supplier_contract_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id),

    CONSTRAINT fk_supplier_contract_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_supplier_contract_status
        CHECK (
            status IN (
                'DRAFT',
                'ACTIVE',
                'EXPIRED',
                'TERMINATED'
            )
        ),

    CONSTRAINT ck_supplier_contract_dates
        CHECK (
            end_date >= start_date
        ),

    CONSTRAINT ck_supplier_contract_value
        CHECK (
            contract_value >= 0
        ),

    CONSTRAINT ck_supplier_contract_notice
        CHECK (
            notice_period_days >= 0
        )
);

CREATE TABLE supplier_compliance_documents (
    id UUID PRIMARY KEY,

    supplier_id
        UUID
        NOT NULL,

    contract_id
        UUID,

    document_type
        VARCHAR(120)
        NOT NULL,

    document_name
        VARCHAR(200)
        NOT NULL,

    document_reference
        VARCHAR(200),

    required
        BOOLEAN
        NOT NULL,

    issue_date
        DATE,

    expiry_date
        DATE,

    notes
        VARCHAR(2000),

    created_by_user_id
        UUID
        NOT NULL,

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

    CONSTRAINT fk_supplier_compliance_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id),

    CONSTRAINT fk_supplier_compliance_contract
        FOREIGN KEY (
            contract_id
        )
        REFERENCES supplier_contracts (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_supplier_compliance_created_by
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_supplier_compliance_dates
        CHECK (
            expiry_date IS NULL
            OR issue_date IS NULL
            OR expiry_date >= issue_date
        )
);

CREATE INDEX idx_supplier_contracts_supplier
    ON supplier_contracts (
        supplier_id,
        status
    );

CREATE INDEX idx_supplier_contracts_end_date
    ON supplier_contracts (
        end_date
    );

CREATE INDEX idx_supplier_contracts_status
    ON supplier_contracts (
        status
    );

CREATE INDEX idx_compliance_documents_supplier
    ON supplier_compliance_documents (
        supplier_id
    );

CREATE INDEX idx_compliance_documents_contract
    ON supplier_compliance_documents (
        contract_id
    );

CREATE INDEX idx_compliance_documents_expiry
    ON supplier_compliance_documents (
        expiry_date
    );
