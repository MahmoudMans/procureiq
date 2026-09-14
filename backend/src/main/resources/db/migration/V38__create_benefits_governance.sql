CREATE SEQUENCE procurement_execution_portfolio_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_execution_portfolios (
    id UUID PRIMARY KEY,

    portfolio_number
        VARCHAR(50)
        NOT NULL,

    source_scenario_id
        UUID
        NOT NULL,

    source_scenario_code
        VARCHAR(50)
        NOT NULL,

    source_scenario_name
        VARCHAR(240)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    owner_user_id
        UUID
        NOT NULL,

    authorized_by_user_id
        UUID
        NOT NULL,

    authorized_at
        TIMESTAMPTZ
        NOT NULL,

    baseline_selected_budget
        NUMERIC(19, 2)
        NOT NULL,

    baseline_target_savings
        NUMERIC(19, 2)
        NOT NULL,

    baseline_average_risk
        NUMERIC(6, 2)
        NOT NULL,

    selected_initiative_count
        INTEGER
        NOT NULL,

    notes
        VARCHAR(3000),

    closed_at
        TIMESTAMPTZ,

    archived_at
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

    CONSTRAINT uk_execution_portfolio_number
        UNIQUE (
            portfolio_number
        ),

    CONSTRAINT uk_execution_portfolio_source_scenario
        UNIQUE (
            source_scenario_id
        ),

    CONSTRAINT fk_execution_portfolio_scenario
        FOREIGN KEY (
            source_scenario_id
        )
        REFERENCES procurement_portfolio_scenarios (id),

    CONSTRAINT fk_execution_portfolio_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_execution_portfolio_authorized_by
        FOREIGN KEY (
            authorized_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_execution_portfolio_status
        CHECK (
            status IN (
                'AUTHORIZED',
                'IN_EXECUTION',
                'CLOSED',
                'ARCHIVED'
            )
        ),

    CONSTRAINT ck_execution_portfolio_baseline_risk
        CHECK (
            baseline_average_risk
                BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_benefit_items (
    id UUID PRIMARY KEY,

    portfolio_id
        UUID
        NOT NULL,

    scenario_item_id
        UUID
        NOT NULL,

    initiative_id
        UUID
        NOT NULL,

    strategy_id
        UUID
        NOT NULL,

    category_name_snapshot
        VARCHAR(180)
        NOT NULL,

    initiative_number_snapshot
        VARCHAR(50)
        NOT NULL,

    initiative_title_snapshot
        VARCHAR(240)
        NOT NULL,

    benefit_owner_user_id
        UUID
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    baseline_target_savings
        NUMERIC(19, 2)
        NOT NULL,

    forecast_savings
        NUMERIC(19, 2)
        NOT NULL,

    validation_requested_amount
        NUMERIC(19, 2),

    validation_request_note
        VARCHAR(2500),

    validation_requested_by_user_id
        UUID,

    validation_requested_at
        TIMESTAMPTZ,

    validated_savings
        NUMERIC(19, 2)
        NOT NULL
        DEFAULT 0,

    validated_by_user_id
        UUID,

    validation_note
        VARCHAR(2500),

    validated_at
        TIMESTAMPTZ,

    expected_realization_date
        DATE,

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

    CONSTRAINT fk_benefit_item_portfolio
        FOREIGN KEY (
            portfolio_id
        )
        REFERENCES procurement_execution_portfolios (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_benefit_item_scenario_item
        FOREIGN KEY (
            scenario_item_id
        )
        REFERENCES procurement_portfolio_scenario_items (id),

    CONSTRAINT fk_benefit_item_initiative
        FOREIGN KEY (
            initiative_id
        )
        REFERENCES procurement_category_initiatives (id),

    CONSTRAINT fk_benefit_item_strategy
        FOREIGN KEY (
            strategy_id
        )
        REFERENCES procurement_category_strategies (id),

    CONSTRAINT fk_benefit_item_owner
        FOREIGN KEY (
            benefit_owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_benefit_item_validation_request_user
        FOREIGN KEY (
            validation_requested_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_benefit_item_validator
        FOREIGN KEY (
            validated_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_benefit_item_portfolio_initiative
        UNIQUE (
            portfolio_id,
            initiative_id
        ),

    CONSTRAINT uk_benefit_item_scenario_item
        UNIQUE (
            scenario_item_id
        ),

    CONSTRAINT ck_benefit_item_status
        CHECK (
            status IN (
                'PLANNED',
                'IN_PROGRESS',
                'VALIDATION_PENDING',
                'VALIDATED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_benefit_item_values
        CHECK (
            baseline_target_savings
                >= 0
            AND forecast_savings
                >= 0
            AND validated_savings
                >= 0
            AND (
                validation_requested_amount
                    IS NULL
                OR validation_requested_amount
                    >= 0
            )
        )
);

CREATE TABLE procurement_benefit_assumptions (
    id UUID PRIMARY KEY,

    portfolio_id
        UUID
        NOT NULL,

    assumption_type
        VARCHAR(30)
        NOT NULL,

    description
        VARCHAR(2500)
        NOT NULL,

    financial_impact
        NUMERIC(19, 2)
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    owner_user_id
        UUID
        NOT NULL,

    review_date
        DATE,

    resolution_note
        VARCHAR(2500),

    resolved_by_user_id
        UUID,

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

    CONSTRAINT fk_benefit_assumption_portfolio
        FOREIGN KEY (
            portfolio_id
        )
        REFERENCES procurement_execution_portfolios (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_benefit_assumption_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_benefit_assumption_resolver
        FOREIGN KEY (
            resolved_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_benefit_assumption_type
        CHECK (
            assumption_type IN (
                'DEMAND',
                'PRICE',
                'VOLUME',
                'TIMING',
                'FX',
                'SCOPE',
                'OTHER'
            )
        ),

    CONSTRAINT ck_benefit_assumption_status
        CHECK (
            status IN (
                'ACTIVE',
                'CONFIRMED',
                'INVALIDATED'
            )
        )
);

CREATE TABLE procurement_benefit_leakage (
    id UUID PRIMARY KEY,

    benefit_item_id
        UUID
        NOT NULL,

    leakage_type
        VARCHAR(40)
        NOT NULL,

    amount
        NUMERIC(19, 2)
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    description
        VARCHAR(2500)
        NOT NULL,

    owner_user_id
        UUID
        NOT NULL,

    due_date
        DATE,

    resolution_note
        VARCHAR(2500),

    resolved_by_user_id
        UUID,

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

    CONSTRAINT fk_benefit_leakage_item
        FOREIGN KEY (
            benefit_item_id
        )
        REFERENCES procurement_benefit_items (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_benefit_leakage_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_benefit_leakage_resolver
        FOREIGN KEY (
            resolved_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_benefit_leakage_type
        CHECK (
            leakage_type IN (
                'DEMAND_EROSION',
                'PRICE_VARIANCE',
                'SCOPE_CHANGE',
                'TIMING_SLIPPAGE',
                'FX_IMPACT',
                'OTHER'
            )
        ),

    CONSTRAINT ck_benefit_leakage_status
        CHECK (
            status IN (
                'OPEN',
                'MITIGATED',
                'ACCEPTED',
                'RESOLVED'
            )
        ),

    CONSTRAINT ck_benefit_leakage_amount
        CHECK (
            amount >= 0
        )
);

CREATE INDEX idx_execution_portfolio_status
    ON procurement_execution_portfolios (
        currency,
        status,
        updated_at DESC
    );

CREATE INDEX idx_benefit_item_portfolio
    ON procurement_benefit_items (
        portfolio_id,
        status
    );

CREATE INDEX idx_benefit_item_owner
    ON procurement_benefit_items (
        benefit_owner_user_id,
        status
    );

CREATE INDEX idx_benefit_assumption_portfolio
    ON procurement_benefit_assumptions (
        portfolio_id,
        status,
        review_date
    );

CREATE INDEX idx_benefit_leakage_item
    ON procurement_benefit_leakage (
        benefit_item_id,
        status,
        due_date
    );

CREATE TRIGGER trg_audit_procurement_execution_portfolios
AFTER INSERT OR UPDATE OR DELETE
ON procurement_execution_portfolios
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_benefit_items
AFTER INSERT OR UPDATE OR DELETE
ON procurement_benefit_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_benefit_assumptions
AFTER INSERT OR UPDATE OR DELETE
ON procurement_benefit_assumptions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_benefit_leakage
AFTER INSERT OR UPDATE OR DELETE
ON procurement_benefit_leakage
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
