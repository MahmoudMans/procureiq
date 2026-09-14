CREATE TABLE supplier_document_requirements (
    id UUID PRIMARY KEY,

    requirement_code
        VARCHAR(120)
        NOT NULL,

    name
        VARCHAR(240)
        NOT NULL,

    description
        VARCHAR(2000)
        NOT NULL,

    document_type
        VARCHAR(50)
        NOT NULL,

    category_scope
        VARCHAR(180),

    mandatory
        BOOLEAN
        NOT NULL,

    expiry_required
        BOOLEAN
        NOT NULL,

    renewal_lead_days
        INTEGER
        NOT NULL,

    onboarding_relevant
        BOOLEAN
        NOT NULL,

    sustainability_relevant
        BOOLEAN
        NOT NULL,

    active
        BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_supplier_document_requirement_code
        UNIQUE (
            requirement_code
        ),

    CONSTRAINT ck_supplier_document_requirement_type
        CHECK (
            document_type IN (
                'COMPANY_REGISTRATION',
                'TAX_CERTIFICATE',
                'INSURANCE_CERTIFICATE',
                'BANK_INFORMATION',
                'CODE_OF_CONDUCT',
                'ESG_POLICY',
                'QUALITY_CERTIFICATE',
                'OTHER'
            )
        ),

    CONSTRAINT ck_supplier_document_renewal_lead
        CHECK (
            renewal_lead_days
                BETWEEN 0 AND 730
        )
);

CREATE TABLE supplier_compliance_documents (
    id UUID PRIMARY KEY,

    supplier_id
        UUID
        NOT NULL,

    requirement_id
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

    CONSTRAINT fk_supplier_compliance_document_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_supplier_compliance_document_requirement
        FOREIGN KEY (
            requirement_id
        )
        REFERENCES supplier_document_requirements (id),

    CONSTRAINT uk_supplier_compliance_document
        UNIQUE (
            supplier_id,
            requirement_id
        )
);

CREATE TABLE supplier_compliance_document_versions (
    id UUID PRIMARY KEY,

    document_id
        UUID
        NOT NULL,

    version_number
        INTEGER
        NOT NULL,

    original_file_name
        VARCHAR(500)
        NOT NULL,

    content_type
        VARCHAR(200)
        NOT NULL,

    file_size_bytes
        BIGINT
        NOT NULL,

    sha256_checksum
        VARCHAR(64)
        NOT NULL,

    content_bytes
        BYTEA
        NOT NULL,

    expiry_date
        DATE,

    status
        VARCHAR(30)
        NOT NULL,

    submitted_by_portal_account_id
        UUID,

    submitted_by_user_id
        UUID,

    reviewed_by_user_id
        UUID,

    review_note
        VARCHAR(2500),

    reviewed_at
        TIMESTAMPTZ,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_supplier_document_version_document
        FOREIGN KEY (
            document_id
        )
        REFERENCES supplier_compliance_documents (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_supplier_document_version_portal_account
        FOREIGN KEY (
            submitted_by_portal_account_id
        )
        REFERENCES supplier_portal_accounts (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_supplier_document_version_internal_submitter
        FOREIGN KEY (
            submitted_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_supplier_document_version_reviewer
        FOREIGN KEY (
            reviewed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_supplier_document_version_number
        UNIQUE (
            document_id,
            version_number
        ),

    CONSTRAINT uk_supplier_document_checksum_version
        UNIQUE (
            document_id,
            sha256_checksum
        ),

    CONSTRAINT ck_supplier_document_version_status
        CHECK (
            status IN (
                'SUBMITTED',
                'VALID',
                'REJECTED'
            )
        ),

    CONSTRAINT ck_supplier_document_file_size
        CHECK (
            file_size_bytes
                BETWEEN 1 AND 5242880
        ),

    CONSTRAINT ck_supplier_document_submitter
        CHECK (
            (
                submitted_by_portal_account_id
                    IS NOT NULL
                AND submitted_by_user_id
                    IS NULL
            )
            OR
            (
                submitted_by_portal_account_id
                    IS NULL
                AND submitted_by_user_id
                    IS NOT NULL
            )
        )
);

CREATE TABLE supplier_compliance_document_events (
    id UUID PRIMARY KEY,

    document_id
        UUID
        NOT NULL,

    version_id
        UUID
        NOT NULL,

    event_type
        VARCHAR(30)
        NOT NULL,

    actor_user_id
        UUID,

    actor_portal_account_id
        UUID,

    note
        VARCHAR(2500),

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_supplier_document_event_document
        FOREIGN KEY (
            document_id
        )
        REFERENCES supplier_compliance_documents (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_supplier_document_event_version
        FOREIGN KEY (
            version_id
        )
        REFERENCES supplier_compliance_document_versions (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_supplier_document_event_user
        FOREIGN KEY (
            actor_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_supplier_document_event_portal_account
        FOREIGN KEY (
            actor_portal_account_id
        )
        REFERENCES supplier_portal_accounts (id)
        ON DELETE SET NULL,

    CONSTRAINT ck_supplier_document_event_type
        CHECK (
            event_type IN (
                'SUBMITTED',
                'VALIDATED',
                'REJECTED'
            )
        ),

    CONSTRAINT ck_supplier_document_event_actor
        CHECK (
            (
                actor_user_id
                    IS NOT NULL
                AND actor_portal_account_id
                    IS NULL
            )
            OR
            (
                actor_user_id
                    IS NULL
                AND actor_portal_account_id
                    IS NOT NULL
            )
        )
);

CREATE INDEX idx_supplier_document_requirement_scope
    ON supplier_document_requirements (
        active,
        category_scope,
        mandatory
    );

CREATE INDEX idx_supplier_compliance_document_supplier
    ON supplier_compliance_documents (
        supplier_id,
        requirement_id
    );

CREATE INDEX idx_supplier_document_version_latest
    ON supplier_compliance_document_versions (
        document_id,
        version_number DESC
    );

CREATE INDEX idx_supplier_document_version_expiry
    ON supplier_compliance_document_versions (
        expiry_date,
        status
    );

CREATE INDEX idx_supplier_document_event_document
    ON supplier_compliance_document_events (
        document_id,
        created_at DESC
    );

INSERT INTO supplier_document_requirements (
    id,
    requirement_code,
    name,
    description,
    document_type,
    category_scope,
    mandatory,
    expiry_required,
    renewal_lead_days,
    onboarding_relevant,
    sustainability_relevant,
    active,
    created_at,
    updated_at
)
VALUES
    (
        '00000000-0000-0000-0000-000000003601',
        'COMPANY_REGISTRATION',
        'Company registration',
        'Current legal company-registration evidence for the supplier entity.',
        'COMPANY_REGISTRATION',
        NULL,
        TRUE,
        FALSE,
        30,
        TRUE,
        FALSE,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        '00000000-0000-0000-0000-000000003602',
        'TAX_CERTIFICATE',
        'Tax certificate',
        'Current tax-registration or tax-compliance certificate.',
        'TAX_CERTIFICATE',
        NULL,
        TRUE,
        TRUE,
        30,
        TRUE,
        FALSE,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        '00000000-0000-0000-0000-000000003603',
        'INSURANCE_CERTIFICATE',
        'Insurance certificate',
        'Current insurance evidence appropriate to the supplier engagement.',
        'INSURANCE_CERTIFICATE',
        NULL,
        TRUE,
        TRUE,
        45,
        TRUE,
        FALSE,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        '00000000-0000-0000-0000-000000003604',
        'SUPPLIER_CODE_OF_CONDUCT',
        'Supplier code of conduct',
        'Signed responsible-business or supplier code-of-conduct acknowledgement.',
        'CODE_OF_CONDUCT',
        NULL,
        TRUE,
        TRUE,
        60,
        FALSE,
        TRUE,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        '00000000-0000-0000-0000-000000003605',
        'ESG_POLICY',
        'ESG / sustainability policy',
        'Supplier environmental, social or sustainability policy evidence.',
        'ESG_POLICY',
        NULL,
        TRUE,
        TRUE,
        60,
        FALSE,
        TRUE,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );

ALTER TABLE supplier_portal_audit_events
    DROP CONSTRAINT ck_supplier_portal_audit_event_type;

ALTER TABLE supplier_portal_audit_events
    ADD CONSTRAINT ck_supplier_portal_audit_event_type
    CHECK (
        event_type IN (
            'INVITATION_CREATED',
            'ACCOUNT_ACTIVATED',
            'LOGIN_SUCCEEDED',
            'LOGOUT',
            'ACCOUNT_SUSPENDED',
            'ACCOUNT_REINSTATED',
            'ACCOUNT_REVOKED',
            'WORKSPACE_VIEWED',
            'SUPPLIER_RESPONSE_RECORDED',
            'SUPPLIER_ACTION_COMPLETED',
            'DOCUMENT_SUBMITTED',
            'DOCUMENT_DOWNLOADED'
        )
    );

CREATE TRIGGER trg_audit_supplier_document_requirements
AFTER INSERT OR UPDATE OR DELETE
ON supplier_document_requirements
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_supplier_compliance_documents
AFTER INSERT OR UPDATE OR DELETE
ON supplier_compliance_documents
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
