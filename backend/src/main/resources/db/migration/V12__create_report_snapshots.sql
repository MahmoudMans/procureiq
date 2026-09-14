CREATE TABLE report_snapshots (
    id UUID PRIMARY KEY,

    report_type
        VARCHAR(60)
        NOT NULL,

    period_start
        DATE
        NOT NULL,

    period_end
        DATE
        NOT NULL,

    label
        VARCHAR(200)
        NOT NULL,

    payload
        TEXT
        NOT NULL,

    created_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_report_snapshots_user
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_report_snapshots_period
        CHECK (
            period_end >= period_start
        ),

    CONSTRAINT ck_report_snapshots_type
        CHECK (
            report_type IN (
                'EXECUTIVE',
                'SUPPLIER_SPEND',
                'CATEGORY_SPEND',
                'SOURCING_SAVINGS',
                'PURCHASE_ORDERS',
                'DELIVERIES'
            )
        )
);

CREATE INDEX idx_report_snapshots_created
    ON report_snapshots (
        created_at DESC
    );

CREATE INDEX idx_report_snapshots_type
    ON report_snapshots (
        report_type,
        created_at DESC
    );
