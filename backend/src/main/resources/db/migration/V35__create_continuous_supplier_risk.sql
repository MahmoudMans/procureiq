CREATE SEQUENCE supplier_risk_escalation_case_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE supplier_risk_evaluations (
    id UUID PRIMARY KEY,

    supplier_id
        UUID
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    overall_score
        NUMERIC(6, 2)
        NOT NULL,

    risk_band
        VARCHAR(20)
        NOT NULL,

    recommendation
        VARCHAR(30)
        NOT NULL,

    previous_score
        NUMERIC(6, 2),

    delta_score
        NUMERIC(7, 2),

    deterioration
        BOOLEAN
        NOT NULL,

    spend_exposure
        NUMERIC(19, 2)
        NOT NULL,

    category_spend_share
        NUMERIC(7, 2)
        NOT NULL,

    evaluated_by_user_id
        UUID
        NOT NULL,

    evaluated_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_supplier_risk_evaluation_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_supplier_risk_evaluation_user
        FOREIGN KEY (
            evaluated_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_supplier_risk_evaluation_score
        CHECK (
            overall_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_supplier_risk_band
        CHECK (
            risk_band IN (
                'LOW',
                'MODERATE',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_supplier_risk_recommendation
        CHECK (
            recommendation IN (
                'MONITOR',
                'WATCHLIST',
                'REQUALIFY',
                'ESCALATE',
                'CRITICAL_REVIEW'
            )
        )
);

CREATE TABLE supplier_risk_evaluation_factors (
    id UUID PRIMARY KEY,

    evaluation_id
        UUID
        NOT NULL,

    factor_code
        VARCHAR(40)
        NOT NULL,

    factor_score
        NUMERIC(6, 2)
        NOT NULL,

    weight_pct
        NUMERIC(6, 2)
        NOT NULL,

    contribution
        NUMERIC(6, 2)
        NOT NULL,

    details
        VARCHAR(2500)
        NOT NULL,

    CONSTRAINT fk_supplier_risk_factor_evaluation
        FOREIGN KEY (
            evaluation_id
        )
        REFERENCES supplier_risk_evaluations (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_supplier_risk_factor
        UNIQUE (
            evaluation_id,
            factor_code
        ),

    CONSTRAINT ck_supplier_risk_factor_code
        CHECK (
            factor_code IN (
                'ONBOARDING',
                'DOCUMENT_COMPLIANCE',
                'ESG',
                'CONTROL_ANOMALY',
                'COLLABORATION',
                'COMMERCIAL',
                'SPEND_DEPENDENCY'
            )
        ),

    CONSTRAINT ck_supplier_risk_factor_score
        CHECK (
            factor_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_supplier_risk_factor_weight
        CHECK (
            weight_pct
                BETWEEN 0 AND 100
        )
);

CREATE TABLE supplier_risk_watchlist (
    id UUID PRIMARY KEY,

    supplier_id
        UUID
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    reason
        VARCHAR(2000)
        NOT NULL,

    added_by_user_id
        UUID
        NOT NULL,

    added_at
        TIMESTAMPTZ
        NOT NULL,

    released_by_user_id
        UUID,

    release_note
        VARCHAR(2000),

    released_at
        TIMESTAMPTZ,

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    version
        BIGINT
        NOT NULL
        DEFAULT 0,

    CONSTRAINT uk_supplier_risk_watchlist_supplier
        UNIQUE (
            supplier_id
        ),

    CONSTRAINT fk_supplier_risk_watchlist_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_supplier_risk_watchlist_added_by
        FOREIGN KEY (
            added_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_supplier_risk_watchlist_released_by
        FOREIGN KEY (
            released_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_supplier_risk_watchlist_status
        CHECK (
            status IN (
                'ACTIVE',
                'RELEASED'
            )
        )
);

CREATE TABLE supplier_risk_alerts (
    id UUID PRIMARY KEY,

    alert_key
        VARCHAR(220)
        NOT NULL,

    supplier_id
        UUID
        NOT NULL,

    evaluation_id
        UUID
        NOT NULL,

    alert_type
        VARCHAR(40)
        NOT NULL,

    severity
        VARCHAR(20)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    title
        VARCHAR(240)
        NOT NULL,

    details
        VARCHAR(2500)
        NOT NULL,

    acknowledged_by_user_id
        UUID,

    acknowledgement_note
        VARCHAR(2000),

    acknowledged_at
        TIMESTAMPTZ,

    resolved_at
        TIMESTAMPTZ,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    last_seen_at
        TIMESTAMPTZ
        NOT NULL,

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    version
        BIGINT
        NOT NULL
        DEFAULT 0,

    CONSTRAINT uk_supplier_risk_alert_key
        UNIQUE (
            alert_key
        ),

    CONSTRAINT fk_supplier_risk_alert_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_supplier_risk_alert_evaluation
        FOREIGN KEY (
            evaluation_id
        )
        REFERENCES supplier_risk_evaluations (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_supplier_risk_alert_ack_user
        FOREIGN KEY (
            acknowledged_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_supplier_risk_alert_type
        CHECK (
            alert_type IN (
                'HIGH_RISK',
                'DETERIORATION',
                'REQUALIFICATION_REQUIRED',
                'COMPLIANCE_GAP'
            )
        ),

    CONSTRAINT ck_supplier_risk_alert_severity
        CHECK (
            severity IN (
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_supplier_risk_alert_status
        CHECK (
            status IN (
                'OPEN',
                'ACKNOWLEDGED',
                'RESOLVED'
            )
        )
);

CREATE TABLE supplier_risk_escalation_cases (
    id UUID PRIMARY KEY,

    case_number
        VARCHAR(50)
        NOT NULL,

    supplier_id
        UUID
        NOT NULL,

    alert_id
        UUID,

    owner_user_id
        UUID
        NOT NULL,

    priority
        VARCHAR(20)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    due_date
        DATE
        NOT NULL,

    rationale
        VARCHAR(2500)
        NOT NULL,

    resolution_note
        VARCHAR(2500),

    closed_at
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

    CONSTRAINT uk_supplier_risk_escalation_case_number
        UNIQUE (
            case_number
        ),

    CONSTRAINT fk_supplier_risk_escalation_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_supplier_risk_escalation_alert
        FOREIGN KEY (
            alert_id
        )
        REFERENCES supplier_risk_alerts (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_supplier_risk_escalation_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_supplier_risk_escalation_priority
        CHECK (
            priority IN (
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_supplier_risk_escalation_status
        CHECK (
            status IN (
                'OPEN',
                'IN_PROGRESS',
                'CLOSED',
                'CANCELLED'
            )
        )
);

CREATE INDEX idx_supplier_risk_evaluation_supplier
    ON supplier_risk_evaluations (
        supplier_id,
        currency,
        evaluated_at DESC
    );

CREATE INDEX idx_supplier_risk_evaluation_band
    ON supplier_risk_evaluations (
        currency,
        risk_band,
        evaluated_at DESC
    );

CREATE INDEX idx_supplier_risk_alert_status
    ON supplier_risk_alerts (
        status,
        severity,
        last_seen_at DESC
    );

CREATE INDEX idx_supplier_risk_alert_supplier
    ON supplier_risk_alerts (
        supplier_id,
        status
    );

CREATE INDEX idx_supplier_risk_watchlist_status
    ON supplier_risk_watchlist (
        status,
        updated_at DESC
    );

CREATE INDEX idx_supplier_risk_escalation_status
    ON supplier_risk_escalation_cases (
        status,
        priority,
        due_date
    );

CREATE INDEX idx_supplier_risk_escalation_supplier
    ON supplier_risk_escalation_cases (
        supplier_id,
        status
    );

CREATE TRIGGER trg_audit_supplier_risk_watchlist
AFTER INSERT OR UPDATE OR DELETE
ON supplier_risk_watchlist
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_supplier_risk_alerts
AFTER INSERT OR UPDATE OR DELETE
ON supplier_risk_alerts
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_supplier_risk_escalation_cases
AFTER INSERT OR UPDATE OR DELETE
ON supplier_risk_escalation_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
