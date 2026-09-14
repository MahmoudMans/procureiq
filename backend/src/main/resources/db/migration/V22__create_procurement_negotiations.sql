CREATE SEQUENCE procurement_negotiation_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_negotiation_workspaces (
    id UUID PRIMARY KEY,

    negotiation_number
        VARCHAR(50)
        NOT NULL,

    rfq_id
        UUID
        NOT NULL,

    supplier_id
        UUID
        NOT NULL,

    baseline_quotation_id
        UUID
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    baseline_value
        NUMERIC(19, 2)
        NOT NULL,

    target_value
        NUMERIC(19, 2),

    walk_away_value
        NUMERIC(19, 2),

    agreed_value
        NUMERIC(19, 2),

    target_savings
        NUMERIC(19, 2)
        NOT NULL
        DEFAULT 0,

    agreed_savings
        NUMERIC(19, 2)
        NOT NULL
        DEFAULT 0,

    agreed_scenario_id
        UUID,

    owner_user_id
        UUID
        NOT NULL,

    notes
        VARCHAR(3000),

    agreed_at
        TIMESTAMPTZ,

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

    CONSTRAINT uk_procurement_negotiation_number
        UNIQUE (
            negotiation_number
        ),

    CONSTRAINT uk_procurement_negotiation_rfq_supplier
        UNIQUE (
            rfq_id,
            supplier_id
        ),

    CONSTRAINT fk_negotiation_rfq
        FOREIGN KEY (
            rfq_id
        )
        REFERENCES rfqs (id),

    CONSTRAINT fk_negotiation_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id),

    CONSTRAINT fk_negotiation_baseline_quotation
        FOREIGN KEY (
            baseline_quotation_id
        )
        REFERENCES quotations (id),

    CONSTRAINT fk_negotiation_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_negotiation_status
        CHECK (
            status IN (
                'DRAFT',
                'ACTIVE',
                'AGREED',
                'CLOSED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_negotiation_currency
        CHECK (
            CHAR_LENGTH(currency) = 3
        ),

    CONSTRAINT ck_negotiation_baseline_value
        CHECK (
            baseline_value >= 0
        ),

    CONSTRAINT ck_negotiation_target_value
        CHECK (
            target_value IS NULL
            OR target_value >= 0
        ),

    CONSTRAINT ck_negotiation_walk_away_value
        CHECK (
            walk_away_value IS NULL
            OR walk_away_value >= 0
        ),

    CONSTRAINT ck_negotiation_agreed_value
        CHECK (
            agreed_value IS NULL
            OR agreed_value >= 0
        )
);

CREATE TABLE procurement_negotiation_scenarios (
    id UUID PRIMARY KEY,

    workspace_id
        UUID
        NOT NULL,

    name
        VARCHAR(220)
        NOT NULL,

    scenario_type
        VARCHAR(30)
        NOT NULL,

    total_value
        NUMERIC(19, 2)
        NOT NULL,

    payment_terms_days
        INTEGER
        NOT NULL,

    lead_time_days
        INTEGER
        NOT NULL,

    warranty_months
        INTEGER
        NOT NULL,

    volume_commitment
        INTEGER,

    price_savings
        NUMERIC(19, 2)
        NOT NULL,

    savings_pct
        NUMERIC(9, 2)
        NOT NULL,

    scenario_score
        NUMERIC(9, 2)
        NOT NULL,

    preferred
        BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    notes
        VARCHAR(3000),

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

    CONSTRAINT fk_negotiation_scenario_workspace
        FOREIGN KEY (
            workspace_id
        )
        REFERENCES procurement_negotiation_workspaces (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_negotiation_scenario_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_negotiation_scenario_type
        CHECK (
            scenario_type IN (
                'TARGET',
                'WALK_AWAY',
                'OPTION',
                'FINAL'
            )
        ),

    CONSTRAINT ck_negotiation_scenario_value
        CHECK (
            total_value >= 0
        ),

    CONSTRAINT ck_negotiation_payment_terms
        CHECK (
            payment_terms_days >= 0
        ),

    CONSTRAINT ck_negotiation_lead_time
        CHECK (
            lead_time_days >= 0
        ),

    CONSTRAINT ck_negotiation_warranty
        CHECK (
            warranty_months >= 0
        ),

    CONSTRAINT ck_negotiation_volume
        CHECK (
            volume_commitment IS NULL
            OR volume_commitment >= 0
        ),

    CONSTRAINT ck_negotiation_scenario_score
        CHECK (
            scenario_score
                BETWEEN 0 AND 100
        )
);

ALTER TABLE procurement_negotiation_workspaces
    ADD CONSTRAINT fk_negotiation_agreed_scenario
    FOREIGN KEY (
        agreed_scenario_id
    )
    REFERENCES procurement_negotiation_scenarios (id)
    ON DELETE SET NULL;

CREATE TABLE procurement_negotiation_rounds (
    id UUID PRIMARY KEY,

    workspace_id
        UUID
        NOT NULL,

    round_number
        INTEGER
        NOT NULL,

    actor_side
        VARCHAR(20)
        NOT NULL,

    offer_value
        NUMERIC(19, 2)
        NOT NULL,

    payment_terms_days
        INTEGER
        NOT NULL,

    lead_time_days
        INTEGER
        NOT NULL,

    warranty_months
        INTEGER
        NOT NULL,

    volume_commitment
        INTEGER,

    notes
        VARCHAR(3000),

    created_by_user_id
        UUID
        NOT NULL,

    round_at
        TIMESTAMPTZ
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_negotiation_round_workspace
        FOREIGN KEY (
            workspace_id
        )
        REFERENCES procurement_negotiation_workspaces (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_negotiation_round_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_negotiation_round_number
        UNIQUE (
            workspace_id,
            round_number
        ),

    CONSTRAINT ck_negotiation_round_actor
        CHECK (
            actor_side IN (
                'BUYER',
                'SUPPLIER'
            )
        ),

    CONSTRAINT ck_negotiation_round_value
        CHECK (
            offer_value >= 0
        ),

    CONSTRAINT ck_negotiation_round_payment
        CHECK (
            payment_terms_days >= 0
        ),

    CONSTRAINT ck_negotiation_round_lead
        CHECK (
            lead_time_days >= 0
        ),

    CONSTRAINT ck_negotiation_round_warranty
        CHECK (
            warranty_months >= 0
        )
);

CREATE INDEX idx_negotiation_workspace_status
    ON procurement_negotiation_workspaces (
        status,
        updated_at DESC
    );

CREATE INDEX idx_negotiation_workspace_rfq
    ON procurement_negotiation_workspaces (
        rfq_id,
        status
    );

CREATE INDEX idx_negotiation_workspace_supplier
    ON procurement_negotiation_workspaces (
        supplier_id,
        status
    );

CREATE INDEX idx_negotiation_scenario_workspace
    ON procurement_negotiation_scenarios (
        workspace_id,
        scenario_type
    );

CREATE INDEX idx_negotiation_round_workspace
    ON procurement_negotiation_rounds (
        workspace_id,
        round_number
    );

CREATE TRIGGER trg_audit_procurement_negotiation_workspaces
AFTER INSERT OR UPDATE OR DELETE
ON procurement_negotiation_workspaces
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_negotiation_scenarios
AFTER INSERT OR UPDATE OR DELETE
ON procurement_negotiation_scenarios
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_negotiation_rounds
AFTER INSERT OR UPDATE OR DELETE
ON procurement_negotiation_rounds
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
