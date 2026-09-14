CREATE TABLE supplier_portal_accounts (
    id UUID PRIMARY KEY,

    supplier_id
        UUID
        NOT NULL,

    email
        VARCHAR(320)
        NOT NULL,

    display_name
        VARCHAR(220)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    password_hash
        VARCHAR(120),

    invitation_token_hash
        VARCHAR(64),

    invitation_expires_at
        TIMESTAMPTZ,

    activated_at
        TIMESTAMPTZ,

    last_login_at
        TIMESTAMPTZ,

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

    CONSTRAINT fk_supplier_portal_account_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_supplier_portal_account_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_supplier_portal_account_status
        CHECK (
            status IN (
                'INVITED',
                'ACTIVE',
                'SUSPENDED',
                'REVOKED'
            )
        ),

    CONSTRAINT ck_supplier_portal_invitation_state
        CHECK (
            (
                status =
                    'INVITED'
                AND invitation_token_hash
                    IS NOT NULL
                AND invitation_expires_at
                    IS NOT NULL
                AND password_hash
                    IS NULL
            )
            OR
            (
                status
                    <> 'INVITED'
            )
        )
);

CREATE UNIQUE INDEX uk_supplier_portal_email_ci
    ON supplier_portal_accounts (
        LOWER(email)
    );

CREATE INDEX idx_supplier_portal_account_supplier
    ON supplier_portal_accounts (
        supplier_id,
        status
    );

CREATE INDEX idx_supplier_portal_invitation_hash
    ON supplier_portal_accounts (
        invitation_token_hash
    )
    WHERE invitation_token_hash
        IS NOT NULL;

CREATE TABLE supplier_portal_sessions (
    id UUID PRIMARY KEY,

    account_id
        UUID
        NOT NULL,

    token_hash
        VARCHAR(64)
        NOT NULL,

    expires_at
        TIMESTAMPTZ
        NOT NULL,

    revoked_at
        TIMESTAMPTZ,

    last_seen_at
        TIMESTAMPTZ
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_supplier_portal_session_account
        FOREIGN KEY (
            account_id
        )
        REFERENCES supplier_portal_accounts (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_supplier_portal_session_token_hash
        UNIQUE (
            token_hash
        )
);

CREATE INDEX idx_supplier_portal_session_account
    ON supplier_portal_sessions (
        account_id,
        expires_at
    );

CREATE INDEX idx_supplier_portal_session_active
    ON supplier_portal_sessions (
        token_hash,
        expires_at
    )
    WHERE revoked_at
        IS NULL;

CREATE TABLE supplier_portal_audit_events (
    id UUID PRIMARY KEY,

    account_id
        UUID,

    supplier_id
        UUID,

    event_type
        VARCHAR(60)
        NOT NULL,

    details
        VARCHAR(2000),

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_supplier_portal_audit_account
        FOREIGN KEY (
            account_id
        )
        REFERENCES supplier_portal_accounts (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_supplier_portal_audit_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id)
        ON DELETE SET NULL,

    CONSTRAINT ck_supplier_portal_audit_event_type
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
                'SUPPLIER_ACTION_COMPLETED'
            )
        )
);

CREATE INDEX idx_supplier_portal_audit_account
    ON supplier_portal_audit_events (
        account_id,
        created_at DESC
    );

CREATE INDEX idx_supplier_portal_audit_supplier
    ON supplier_portal_audit_events (
        supplier_id,
        created_at DESC
    );
