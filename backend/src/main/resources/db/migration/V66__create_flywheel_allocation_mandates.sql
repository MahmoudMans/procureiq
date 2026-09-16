CREATE SEQUENCE procurement_flywheel_allocation_mandate_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_flywheel_allocation_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;


CREATE TABLE procurement_flywheel_allocation_mandates (
    id UUID PRIMARY KEY,

    mandate_number VARCHAR(60) NOT NULL,

    strategy_portfolio_id UUID NOT NULL,
    strategy_portfolio_number VARCHAR(60) NOT NULL,

    title VARCHAR(300) NOT NULL,

    currency VARCHAR(3) NOT NULL,
    fiscal_year INTEGER NOT NULL,

    strategy_capital_capacity_amount
        NUMERIC(20, 2)
        NOT NULL,

    strategy_prioritized_capacity_amount
        NUMERIC(20, 2)
        NOT NULL,

    mandate_owner_user_id UUID NOT NULL,
    mandate_owner_name_snapshot VARCHAR(300) NOT NULL,

    mandate_rationale VARCHAR(5000) NOT NULL,

    status VARCHAR(30) NOT NULL,

    submitted_by_user_id UUID,
    submitted_at TIMESTAMPTZ,

    authorized_by_user_id UUID,
    authorized_at TIMESTAMPTZ,
    authorization_note VARCHAR(5000),

    closed_by_user_id UUID,
    closed_at TIMESTAMPTZ,
    close_note VARCHAR(5000),

    created_by_user_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT uk_flywheel_allocation_mandate_number
        UNIQUE (mandate_number),

    CONSTRAINT fk_flywheel_allocation_strategy_portfolio
        FOREIGN KEY (strategy_portfolio_id)
        REFERENCES procurement_flywheel_strategy_portfolios (id),

    CONSTRAINT fk_flywheel_allocation_owner
        FOREIGN KEY (mandate_owner_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_allocation_submitter
        FOREIGN KEY (submitted_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_allocation_authorizer
        FOREIGN KEY (authorized_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_allocation_closer
        FOREIGN KEY (closed_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_allocation_creator
        FOREIGN KEY (created_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_flywheel_allocation_currency
        CHECK (
            currency ~ '^[A-Z]{3}$'
        ),

    CONSTRAINT ck_flywheel_allocation_fiscal_year
        CHECK (
            fiscal_year BETWEEN 2000 AND 2200
        ),

    CONSTRAINT ck_flywheel_allocation_strategy_capacity
        CHECK (
            strategy_capital_capacity_amount > 0
            AND
            strategy_prioritized_capacity_amount > 0
            AND
            strategy_prioritized_capacity_amount
                <= strategy_capital_capacity_amount
        ),

    CONSTRAINT ck_flywheel_allocation_status
        CHECK (
            status IN (
                'DRAFT',
                'IN_REVIEW',
                'AUTHORIZED',
                'CLOSED'
            )
        )
);


CREATE UNIQUE INDEX uk_flywheel_allocation_open_strategy
    ON procurement_flywheel_allocation_mandates (
        strategy_portfolio_id
    )
    WHERE status <> 'CLOSED';


CREATE TABLE procurement_flywheel_allocation_items (
    id UUID PRIMARY KEY,

    mandate_id UUID NOT NULL,

    strategy_item_id UUID NOT NULL,

    flywheel_lineage_id UUID NOT NULL,
    lineage_number VARCHAR(60) NOT NULL,

    root_target_initiative_title VARCHAR(300) NOT NULL,

    strategy_proposed_capacity_amount
        NUMERIC(20, 2)
        NOT NULL,

    strategy_priority_score
        NUMERIC(7, 2)
        NOT NULL,

    strategy_advisory_recommendation
        VARCHAR(20)
        NOT NULL,

    requested_allocation_amount
        NUMERIC(20, 2)
        NOT NULL,

    added_by_user_id UUID NOT NULL,
    added_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT uk_flywheel_allocation_item
        UNIQUE (
            mandate_id,
            strategy_item_id
        ),

    CONSTRAINT fk_flywheel_allocation_item_mandate
        FOREIGN KEY (mandate_id)
        REFERENCES procurement_flywheel_allocation_mandates (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_flywheel_allocation_item_strategy
        FOREIGN KEY (strategy_item_id)
        REFERENCES procurement_flywheel_strategy_items (id),

    CONSTRAINT fk_flywheel_allocation_item_lineage
        FOREIGN KEY (flywheel_lineage_id)
        REFERENCES procurement_capital_flywheel_lineages (id),

    CONSTRAINT fk_flywheel_allocation_item_adder
        FOREIGN KEY (added_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_flywheel_allocation_item_amount
        CHECK (
            strategy_proposed_capacity_amount > 0
            AND
            requested_allocation_amount > 0
            AND
            requested_allocation_amount
                <= strategy_proposed_capacity_amount
        ),

    CONSTRAINT ck_flywheel_allocation_item_priority
        CHECK (
            strategy_priority_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_flywheel_allocation_item_advisory
        CHECK (
            strategy_advisory_recommendation IN (
                'PRIORITIZE',
                'HOLD',
                'EXIT'
            )
        )
);


CREATE TABLE procurement_flywheel_allocation_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number VARCHAR(60) NOT NULL,

    mandate_id UUID NOT NULL,
    mandate_number VARCHAR(60) NOT NULL,

    strategy_portfolio_id UUID NOT NULL,
    strategy_portfolio_number VARCHAR(60) NOT NULL,

    mandate_status VARCHAR(30) NOT NULL,

    currency VARCHAR(3) NOT NULL,
    fiscal_year INTEGER NOT NULL,

    strategy_prioritized_capacity_amount
        NUMERIC(20, 2)
        NOT NULL,

    requested_allocation_amount
        NUMERIC(20, 2)
        NOT NULL,

    remaining_strategy_capacity_amount
        NUMERIC(20, 2)
        NOT NULL,

    allocation_utilization_pct
        NUMERIC(7, 2)
        NOT NULL,

    item_count INTEGER NOT NULL,

    captured_by_user_id UUID NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT uk_flywheel_allocation_snapshot_number
        UNIQUE (snapshot_number),

    CONSTRAINT fk_flywheel_allocation_snapshot_mandate
        FOREIGN KEY (mandate_id)
        REFERENCES procurement_flywheel_allocation_mandates (id),

    CONSTRAINT fk_flywheel_allocation_snapshot_user
        FOREIGN KEY (captured_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_flywheel_allocation_snapshot_utilization
        CHECK (
            allocation_utilization_pct
                BETWEEN 0 AND 100
        )
);


CREATE TABLE procurement_flywheel_allocation_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id UUID NOT NULL,

    strategy_item_id UUID NOT NULL,

    flywheel_lineage_id UUID NOT NULL,
    lineage_number VARCHAR(60) NOT NULL,

    root_target_initiative_title VARCHAR(300) NOT NULL,

    strategy_proposed_capacity_amount
        NUMERIC(20, 2)
        NOT NULL,

    strategy_priority_score
        NUMERIC(7, 2)
        NOT NULL,

    requested_allocation_amount
        NUMERIC(20, 2)
        NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_flywheel_allocation_snapshot_item_snapshot
        FOREIGN KEY (snapshot_id)
        REFERENCES procurement_flywheel_allocation_snapshots (id)
        ON DELETE CASCADE
);


CREATE INDEX idx_flywheel_allocation_mandate_status
    ON procurement_flywheel_allocation_mandates (
        status,
        fiscal_year,
        currency
    );

CREATE INDEX idx_flywheel_allocation_item_mandate
    ON procurement_flywheel_allocation_items (
        mandate_id,
        strategy_priority_score DESC
    );

CREATE INDEX idx_flywheel_allocation_snapshot_capture
    ON procurement_flywheel_allocation_snapshots (
        mandate_id,
        captured_at DESC
    );


CREATE OR REPLACE FUNCTION procureiq_prevent_flywheel_allocation_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement flywheel allocation snapshot evidence is immutable';
END;
$$;


CREATE TRIGGER trg_flywheel_allocation_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_flywheel_allocation_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_flywheel_allocation_snapshot_mutation();

CREATE TRIGGER trg_flywheel_allocation_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_flywheel_allocation_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_flywheel_allocation_snapshot_mutation();


CREATE TRIGGER trg_audit_flywheel_allocation_mandates
AFTER INSERT OR UPDATE
ON procurement_flywheel_allocation_mandates
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_flywheel_allocation_items
AFTER INSERT OR UPDATE
ON procurement_flywheel_allocation_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_flywheel_allocation_snapshots
AFTER INSERT
ON procurement_flywheel_allocation_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
