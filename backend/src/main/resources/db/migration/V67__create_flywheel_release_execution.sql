CREATE SEQUENCE procurement_flywheel_release_batch_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_flywheel_release_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;


CREATE TABLE procurement_flywheel_release_batches (
    id UUID PRIMARY KEY,

    release_number VARCHAR(60) NOT NULL,

    allocation_mandate_id UUID NOT NULL,
    allocation_mandate_number VARCHAR(60) NOT NULL,

    strategy_portfolio_id UUID NOT NULL,
    strategy_portfolio_number VARCHAR(60) NOT NULL,

    title VARCHAR(300) NOT NULL,

    currency VARCHAR(3) NOT NULL,
    fiscal_year INTEGER NOT NULL,

    mandate_authorized_amount
        NUMERIC(20, 2)
        NOT NULL,

    release_owner_user_id UUID NOT NULL,
    release_owner_name_snapshot VARCHAR(300) NOT NULL,

    release_rationale VARCHAR(5000) NOT NULL,

    status VARCHAR(30) NOT NULL,

    submitted_by_user_id UUID,
    submitted_at TIMESTAMPTZ,

    executed_by_user_id UUID,
    executed_at TIMESTAMPTZ,
    execution_note VARCHAR(5000),

    closed_by_user_id UUID,
    closed_at TIMESTAMPTZ,
    close_note VARCHAR(5000),

    created_by_user_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT uk_flywheel_release_number
        UNIQUE (release_number),

    CONSTRAINT fk_flywheel_release_mandate
        FOREIGN KEY (allocation_mandate_id)
        REFERENCES procurement_flywheel_allocation_mandates (id),

    CONSTRAINT fk_flywheel_release_strategy
        FOREIGN KEY (strategy_portfolio_id)
        REFERENCES procurement_flywheel_strategy_portfolios (id),

    CONSTRAINT fk_flywheel_release_owner
        FOREIGN KEY (release_owner_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_release_submitter
        FOREIGN KEY (submitted_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_release_executor
        FOREIGN KEY (executed_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_release_closer
        FOREIGN KEY (closed_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_release_creator
        FOREIGN KEY (created_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_flywheel_release_currency
        CHECK (
            currency ~ '^[A-Z]{3}$'
        ),

    CONSTRAINT ck_flywheel_release_fiscal_year
        CHECK (
            fiscal_year BETWEEN 2000 AND 2200
        ),

    CONSTRAINT ck_flywheel_release_authorized_amount
        CHECK (
            mandate_authorized_amount > 0
        ),

    CONSTRAINT ck_flywheel_release_status
        CHECK (
            status IN (
                'DRAFT',
                'IN_EXECUTION',
                'EXECUTED',
                'CLOSED'
            )
        )
);


CREATE UNIQUE INDEX uk_flywheel_release_open_mandate
    ON procurement_flywheel_release_batches (
        allocation_mandate_id
    )
    WHERE status <> 'CLOSED';


CREATE TABLE procurement_flywheel_release_items (
    id UUID PRIMARY KEY,

    release_batch_id UUID NOT NULL,

    allocation_item_id UUID NOT NULL,

    strategy_item_id UUID NOT NULL,

    flywheel_lineage_id UUID NOT NULL,
    lineage_number VARCHAR(60) NOT NULL,

    root_target_initiative_title VARCHAR(300) NOT NULL,

    mandate_authorized_item_amount
        NUMERIC(20, 2)
        NOT NULL,

    strategy_priority_score
        NUMERIC(7, 2)
        NOT NULL,

    planned_release_amount
        NUMERIC(20, 2)
        NOT NULL,

    status VARCHAR(20) NOT NULL,

    execution_reference VARCHAR(300),
    execution_note VARCHAR(5000),

    released_by_user_id UUID,
    released_at TIMESTAMPTZ,

    cancelled_by_user_id UUID,
    cancelled_at TIMESTAMPTZ,
    cancellation_note VARCHAR(5000),

    added_by_user_id UUID NOT NULL,
    added_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT uk_flywheel_release_item
        UNIQUE (
            release_batch_id,
            allocation_item_id
        ),

    CONSTRAINT fk_flywheel_release_item_batch
        FOREIGN KEY (release_batch_id)
        REFERENCES procurement_flywheel_release_batches (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_flywheel_release_item_allocation
        FOREIGN KEY (allocation_item_id)
        REFERENCES procurement_flywheel_allocation_items (id),

    CONSTRAINT fk_flywheel_release_item_strategy
        FOREIGN KEY (strategy_item_id)
        REFERENCES procurement_flywheel_strategy_items (id),

    CONSTRAINT fk_flywheel_release_item_lineage
        FOREIGN KEY (flywheel_lineage_id)
        REFERENCES procurement_capital_flywheel_lineages (id),

    CONSTRAINT fk_flywheel_release_item_releaser
        FOREIGN KEY (released_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_release_item_canceller
        FOREIGN KEY (cancelled_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_release_item_adder
        FOREIGN KEY (added_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_flywheel_release_item_amount
        CHECK (
            mandate_authorized_item_amount > 0
            AND
            planned_release_amount > 0
            AND
            planned_release_amount
                <= mandate_authorized_item_amount
        ),

    CONSTRAINT ck_flywheel_release_item_priority
        CHECK (
            strategy_priority_score
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_flywheel_release_item_status
        CHECK (
            status IN (
                'PENDING',
                'RELEASED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_flywheel_release_item_released_evidence
        CHECK (
            status <> 'RELEASED'
            OR (
                execution_reference IS NOT NULL
                AND
                execution_note IS NOT NULL
                AND
                released_by_user_id IS NOT NULL
                AND
                released_at IS NOT NULL
            )
        ),

    CONSTRAINT ck_flywheel_release_item_cancelled_evidence
        CHECK (
            status <> 'CANCELLED'
            OR (
                cancellation_note IS NOT NULL
                AND
                cancelled_by_user_id IS NOT NULL
                AND
                cancelled_at IS NOT NULL
            )
        )
);


CREATE INDEX idx_flywheel_release_batch_status
    ON procurement_flywheel_release_batches (
        status,
        fiscal_year,
        currency
    );

CREATE INDEX idx_flywheel_release_item_batch
    ON procurement_flywheel_release_items (
        release_batch_id,
        status,
        strategy_priority_score DESC
    );

CREATE INDEX idx_flywheel_release_item_allocation
    ON procurement_flywheel_release_items (
        allocation_item_id,
        status
    );

CREATE INDEX idx_flywheel_release_item_mandate_lookup
    ON procurement_flywheel_release_batches (
        allocation_mandate_id,
        status
    );


CREATE TABLE procurement_flywheel_release_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number VARCHAR(60) NOT NULL,

    release_batch_id UUID NOT NULL,
    release_number VARCHAR(60) NOT NULL,

    allocation_mandate_id UUID NOT NULL,
    allocation_mandate_number VARCHAR(60) NOT NULL,

    release_status VARCHAR(30) NOT NULL,

    currency VARCHAR(3) NOT NULL,
    fiscal_year INTEGER NOT NULL,

    mandate_authorized_amount
        NUMERIC(20, 2)
        NOT NULL,

    batch_planned_release_amount
        NUMERIC(20, 2)
        NOT NULL,

    batch_released_amount
        NUMERIC(20, 2)
        NOT NULL,

    cumulative_mandate_released_amount
        NUMERIC(20, 2)
        NOT NULL,

    remaining_mandate_amount
        NUMERIC(20, 2)
        NOT NULL,

    cumulative_release_utilization_pct
        NUMERIC(7, 2)
        NOT NULL,

    item_count INTEGER NOT NULL,
    pending_count INTEGER NOT NULL,
    released_count INTEGER NOT NULL,
    cancelled_count INTEGER NOT NULL,

    captured_by_user_id UUID NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT uk_flywheel_release_snapshot_number
        UNIQUE (snapshot_number),

    CONSTRAINT fk_flywheel_release_snapshot_batch
        FOREIGN KEY (release_batch_id)
        REFERENCES procurement_flywheel_release_batches (id),

    CONSTRAINT fk_flywheel_release_snapshot_user
        FOREIGN KEY (captured_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_flywheel_release_snapshot_utilization
        CHECK (
            cumulative_release_utilization_pct
                BETWEEN 0 AND 100
        )
);


CREATE TABLE procurement_flywheel_release_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id UUID NOT NULL,

    allocation_item_id UUID NOT NULL,

    flywheel_lineage_id UUID NOT NULL,
    lineage_number VARCHAR(60) NOT NULL,

    root_target_initiative_title VARCHAR(300) NOT NULL,

    mandate_authorized_item_amount
        NUMERIC(20, 2)
        NOT NULL,

    planned_release_amount
        NUMERIC(20, 2)
        NOT NULL,

    release_item_status VARCHAR(20) NOT NULL,

    execution_reference VARCHAR(300),
    execution_note VARCHAR(5000),
    cancellation_note VARCHAR(5000),

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_flywheel_release_snapshot_item_snapshot
        FOREIGN KEY (snapshot_id)
        REFERENCES procurement_flywheel_release_snapshots (id)
        ON DELETE CASCADE
);


CREATE INDEX idx_flywheel_release_snapshot_capture
    ON procurement_flywheel_release_snapshots (
        release_batch_id,
        captured_at DESC
    );


CREATE OR REPLACE FUNCTION procureiq_prevent_flywheel_release_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement flywheel release snapshot evidence is immutable';
END;
$$;


CREATE TRIGGER trg_flywheel_release_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_flywheel_release_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_flywheel_release_snapshot_mutation();

CREATE TRIGGER trg_flywheel_release_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_flywheel_release_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_flywheel_release_snapshot_mutation();


CREATE TRIGGER trg_audit_flywheel_release_batches
AFTER INSERT OR UPDATE
ON procurement_flywheel_release_batches
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_flywheel_release_items
AFTER INSERT OR UPDATE
ON procurement_flywheel_release_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_flywheel_release_snapshots
AFTER INSERT
ON procurement_flywheel_release_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
