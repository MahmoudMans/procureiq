CREATE SEQUENCE supplier_performance_review_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE supplier_performance_reviews (
    id UUID PRIMARY KEY,

    review_number
        VARCHAR(40)
        NOT NULL,

    supplier_id
        UUID
        NOT NULL,

    period_start
        DATE
        NOT NULL,

    period_end
        DATE
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    quality_score
        NUMERIC(5, 2)
        NOT NULL,

    delivery_score
        NUMERIC(5, 2)
        NOT NULL,

    commercial_score
        NUMERIC(5, 2)
        NOT NULL,

    service_score
        NUMERIC(5, 2)
        NOT NULL,

    compliance_score
        NUMERIC(5, 2)
        NOT NULL,

    weighted_score
        NUMERIC(5, 2)
        NOT NULL,

    performance_band
        VARCHAR(40)
        NOT NULL,

    supplier_rating_snapshot
        NUMERIC(10, 2),

    supplier_risk_snapshot
        VARCHAR(30),

    po_count_snapshot
        BIGINT
        NOT NULL
        DEFAULT 0,

    po_value_snapshot
        NUMERIC(19, 2)
        NOT NULL
        DEFAULT 0,

    overdue_po_count_snapshot
        BIGINT
        NOT NULL
        DEFAULT 0,

    owner_user_id
        UUID
        NOT NULL,

    submitted_at
        TIMESTAMPTZ,

    decided_by_user_id
        UUID,

    decision_note
        VARCHAR(2000),

    decided_at
        TIMESTAMPTZ,

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

    CONSTRAINT uk_supplier_performance_review_number
        UNIQUE (
            review_number
        ),

    CONSTRAINT uk_supplier_performance_period
        UNIQUE (
            supplier_id,
            period_start,
            period_end
        ),

    CONSTRAINT fk_performance_review_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id),

    CONSTRAINT fk_performance_review_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_performance_review_decider
        FOREIGN KEY (
            decided_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_performance_review_period
        CHECK (
            period_end >= period_start
        ),

    CONSTRAINT ck_performance_review_status
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'APPROVED',
                'REJECTED'
            )
        ),

    CONSTRAINT ck_performance_review_band
        CHECK (
            performance_band IN (
                'EXCELLENT',
                'GOOD',
                'NEEDS_IMPROVEMENT',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_performance_review_quality
        CHECK (
            quality_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_performance_review_delivery
        CHECK (
            delivery_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_performance_review_commercial
        CHECK (
            commercial_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_performance_review_service
        CHECK (
            service_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_performance_review_compliance
        CHECK (
            compliance_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_performance_review_weighted
        CHECK (
            weighted_score
                BETWEEN 0 AND 100
        )
);

CREATE TABLE supplier_corrective_actions (
    id UUID PRIMARY KEY,

    review_id
        UUID
        NOT NULL,

    title
        VARCHAR(220)
        NOT NULL,

    description
        VARCHAR(2000),

    owner_user_id
        UUID
        NOT NULL,

    due_date
        DATE
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    completed_at
        TIMESTAMPTZ,

    completion_note
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

    CONSTRAINT fk_corrective_action_review
        FOREIGN KEY (
            review_id
        )
        REFERENCES supplier_performance_reviews (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_corrective_action_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_corrective_action_status
        CHECK (
            status IN (
                'OPEN',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        )
);

CREATE INDEX idx_supplier_performance_supplier
    ON supplier_performance_reviews (
        supplier_id,
        period_end DESC
    );

CREATE INDEX idx_supplier_performance_status
    ON supplier_performance_reviews (
        status,
        updated_at DESC
    );

CREATE INDEX idx_supplier_performance_band
    ON supplier_performance_reviews (
        performance_band,
        status
    );

CREATE INDEX idx_corrective_action_review
    ON supplier_corrective_actions (
        review_id,
        status
    );

CREATE INDEX idx_corrective_action_due
    ON supplier_corrective_actions (
        due_date,
        status
    );

CREATE INDEX idx_corrective_action_owner
    ON supplier_corrective_actions (
        owner_user_id,
        status
    );

CREATE TRIGGER trg_audit_supplier_performance_reviews
AFTER INSERT OR UPDATE OR DELETE
ON supplier_performance_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_supplier_corrective_actions
AFTER INSERT OR UPDATE OR DELETE
ON supplier_corrective_actions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
