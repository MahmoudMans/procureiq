CREATE SEQUENCE procurement_category_strategy_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_category_initiative_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_category_strategies (
    id UUID PRIMARY KEY,

    strategy_code
        VARCHAR(50)
        NOT NULL,

    category_name
        VARCHAR(180)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    owner_user_id
        UUID
        NOT NULL,

    spend_baseline
        NUMERIC(19, 2)
        NOT NULL,

    modeled_opportunity_amount
        NUMERIC(19, 2)
        NOT NULL,

    savings_target_pct
        NUMERIC(7, 2)
        NOT NULL,

    savings_target_amount
        NUMERIC(19, 2)
        NOT NULL,

    strategic_value_score
        NUMERIC(6, 2)
        NOT NULL,

    supply_risk_score
        NUMERIC(6, 2)
        NOT NULL,

    matrix_position
        VARCHAR(40)
        NOT NULL,

    objectives
        VARCHAR(4000)
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

    CONSTRAINT uk_category_strategy_code
        UNIQUE (
            strategy_code
        ),

    CONSTRAINT uk_category_strategy_scope
        UNIQUE (
            category_name,
            currency,
            fiscal_year
        ),

    CONSTRAINT fk_category_strategy_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_category_strategy_status
        CHECK (
            status IN (
                'DRAFT',
                'ACTIVE',
                'ON_HOLD',
                'CLOSED',
                'ARCHIVED'
            )
        ),

    CONSTRAINT ck_category_strategy_fiscal_year
        CHECK (
            fiscal_year
                BETWEEN 2020 AND 2100
        ),

    CONSTRAINT ck_category_strategy_target_pct
        CHECK (
            savings_target_pct
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_category_strategy_value_score
        CHECK (
            strategic_value_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_category_strategy_risk_score
        CHECK (
            supply_risk_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_category_strategy_matrix
        CHECK (
            matrix_position IN (
                'MANAGE',
                'VALUE_OPTIMIZATION',
                'RISK_MITIGATION',
                'CRITICAL_PRIORITY'
            )
        )
);

CREATE TABLE procurement_category_initiatives (
    id UUID PRIMARY KEY,

    strategy_id
        UUID
        NOT NULL,

    initiative_number
        VARCHAR(50)
        NOT NULL,

    initiative_type
        VARCHAR(50)
        NOT NULL,

    title
        VARCHAR(240)
        NOT NULL,

    description
        VARCHAR(3000),

    priority
        VARCHAR(20)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    owner_user_id
        UUID
        NOT NULL,

    planned_start_date
        DATE,

    planned_end_date
        DATE,

    estimated_value
        NUMERIC(19, 2)
        NOT NULL,

    target_savings
        NUMERIC(19, 2)
        NOT NULL,

    realized_savings
        NUMERIC(19, 2)
        NOT NULL
        DEFAULT 0,

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

    CONSTRAINT uk_category_initiative_number
        UNIQUE (
            initiative_number
        ),

    CONSTRAINT fk_category_initiative_strategy
        FOREIGN KEY (
            strategy_id
        )
        REFERENCES procurement_category_strategies (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_category_initiative_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_category_initiative_type
        CHECK (
            initiative_type IN (
                'SOURCING_WAVE',
                'NEGOTIATION',
                'CONSOLIDATION',
                'SUPPLIER_DIVERSIFICATION',
                'DEMAND_MANAGEMENT',
                'CONTRACT_RENEWAL',
                'RISK_MITIGATION',
                'OTHER'
            )
        ),

    CONSTRAINT ck_category_initiative_priority
        CHECK (
            priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_category_initiative_status
        CHECK (
            status IN (
                'PLANNED',
                'READY',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_category_initiative_dates
        CHECK (
            planned_start_date
                IS NULL
            OR planned_end_date
                IS NULL
            OR planned_end_date
                >= planned_start_date
        )
);

CREATE TABLE procurement_category_milestones (
    id UUID PRIMARY KEY,

    initiative_id
        UUID
        NOT NULL,

    title
        VARCHAR(240)
        NOT NULL,

    due_date
        DATE
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    completion_note
        VARCHAR(2000),

    completed_at
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

    CONSTRAINT fk_category_milestone_initiative
        FOREIGN KEY (
            initiative_id
        )
        REFERENCES procurement_category_initiatives (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_category_milestone_status
        CHECK (
            status IN (
                'OPEN',
                'COMPLETED',
                'CANCELLED'
            )
        )
);

CREATE INDEX idx_category_strategy_scope
    ON procurement_category_strategies (
        currency,
        fiscal_year,
        status
    );

CREATE INDEX idx_category_strategy_category
    ON procurement_category_strategies (
        category_name,
        currency
    );

CREATE INDEX idx_category_initiative_strategy
    ON procurement_category_initiatives (
        strategy_id,
        status,
        priority
    );

CREATE INDEX idx_category_initiative_dates
    ON procurement_category_initiatives (
        planned_start_date,
        planned_end_date
    );

CREATE INDEX idx_category_milestone_initiative
    ON procurement_category_milestones (
        initiative_id,
        status,
        due_date
    );

CREATE TRIGGER trg_audit_procurement_category_strategies
AFTER INSERT OR UPDATE OR DELETE
ON procurement_category_strategies
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_category_initiatives
AFTER INSERT OR UPDATE OR DELETE
ON procurement_category_initiatives
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_procurement_category_milestones
AFTER INSERT OR UPDATE OR DELETE
ON procurement_category_milestones
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
