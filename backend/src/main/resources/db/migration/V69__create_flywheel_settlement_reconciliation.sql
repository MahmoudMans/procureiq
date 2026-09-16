CREATE SEQUENCE procurement_flywheel_settlement_case_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_flywheel_settlement_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;


CREATE TABLE procurement_flywheel_settlement_cases (
    id UUID PRIMARY KEY,

    reconciliation_number VARCHAR(60) NOT NULL,

    release_batch_id UUID NOT NULL,
    release_number VARCHAR(60) NOT NULL,

    allocation_mandate_id UUID NOT NULL,
    allocation_mandate_number VARCHAR(60) NOT NULL,

    strategy_portfolio_id UUID NOT NULL,
    strategy_portfolio_number VARCHAR(60) NOT NULL,

    title VARCHAR(300) NOT NULL,

    currency VARCHAR(3) NOT NULL,
    fiscal_year INTEGER NOT NULL,

    source_released_amount NUMERIC(20, 2) NOT NULL,

    reconciliation_owner_user_id UUID NOT NULL,
    reconciliation_owner_name_snapshot VARCHAR(300) NOT NULL,

    reconciliation_rationale VARCHAR(5000) NOT NULL,

    status VARCHAR(30) NOT NULL,

    submitted_by_user_id UUID,
    submitted_at TIMESTAMPTZ,

    reconciled_by_user_id UUID,
    reconciled_at TIMESTAMPTZ,
    reconciliation_note VARCHAR(5000),

    closed_by_user_id UUID,
    closed_at TIMESTAMPTZ,
    close_note VARCHAR(5000),

    created_by_user_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT uk_flywheel_settlement_case_number
        UNIQUE (reconciliation_number),

    CONSTRAINT uk_flywheel_settlement_release_batch
        UNIQUE (release_batch_id),

    CONSTRAINT fk_flywheel_settlement_release_batch
        FOREIGN KEY (release_batch_id)
        REFERENCES procurement_flywheel_release_batches (id),

    CONSTRAINT fk_flywheel_settlement_allocation_mandate
        FOREIGN KEY (allocation_mandate_id)
        REFERENCES procurement_flywheel_allocation_mandates (id),

    CONSTRAINT fk_flywheel_settlement_strategy_portfolio
        FOREIGN KEY (strategy_portfolio_id)
        REFERENCES procurement_flywheel_strategy_portfolios (id),

    CONSTRAINT fk_flywheel_settlement_owner
        FOREIGN KEY (reconciliation_owner_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_settlement_submitter
        FOREIGN KEY (submitted_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_settlement_reconciler
        FOREIGN KEY (reconciled_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_settlement_closer
        FOREIGN KEY (closed_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_settlement_creator
        FOREIGN KEY (created_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_flywheel_settlement_currency
        CHECK (
            currency ~ '^[A-Z]{3}$'
        ),

    CONSTRAINT ck_flywheel_settlement_fiscal_year
        CHECK (
            fiscal_year BETWEEN 2000 AND 2200
        ),

    CONSTRAINT ck_flywheel_settlement_source_amount
        CHECK (
            source_released_amount > 0
        ),

    CONSTRAINT ck_flywheel_settlement_status
        CHECK (
            status IN (
                'DRAFT',
                'IN_REVIEW',
                'RECONCILED',
                'CLOSED'
            )
        )
);


CREATE TABLE procurement_flywheel_settlement_items (
    id UUID PRIMARY KEY,

    settlement_case_id UUID NOT NULL,

    release_item_id UUID NOT NULL,
    allocation_item_id UUID NOT NULL,

    flywheel_lineage_id UUID NOT NULL,
    lineage_number VARCHAR(60) NOT NULL,

    root_target_initiative_title VARCHAR(300) NOT NULL,

    source_released_amount NUMERIC(20, 2) NOT NULL,

    settled_amount NUMERIC(20, 2) NOT NULL,

    variance_amount NUMERIC(20, 2)
        GENERATED ALWAYS AS (
            source_released_amount
            - settled_amount
        ) STORED,

    reconciliation_status VARCHAR(20) NOT NULL,

    evidence_reference VARCHAR(300),
    evidence_date DATE NOT NULL,

    evidence_note VARCHAR(5000) NOT NULL,

    added_by_user_id UUID NOT NULL,
    added_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT uk_flywheel_settlement_item
        UNIQUE (
            settlement_case_id,
            release_item_id
        ),

    CONSTRAINT fk_flywheel_settlement_item_case
        FOREIGN KEY (settlement_case_id)
        REFERENCES procurement_flywheel_settlement_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_flywheel_settlement_item_release
        FOREIGN KEY (release_item_id)
        REFERENCES procurement_flywheel_release_items (id),

    CONSTRAINT fk_flywheel_settlement_item_allocation
        FOREIGN KEY (allocation_item_id)
        REFERENCES procurement_flywheel_allocation_items (id),

    CONSTRAINT fk_flywheel_settlement_item_lineage
        FOREIGN KEY (flywheel_lineage_id)
        REFERENCES procurement_capital_flywheel_lineages (id),

    CONSTRAINT fk_flywheel_settlement_item_adder
        FOREIGN KEY (added_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_flywheel_settlement_amounts
        CHECK (
            source_released_amount > 0
            AND
            settled_amount >= 0
            AND
            settled_amount <= source_released_amount
        ),

    CONSTRAINT ck_flywheel_settlement_item_status
        CHECK (
            reconciliation_status IN (
                'SETTLED',
                'PARTIAL',
                'UNRESOLVED'
            )
        ),

    CONSTRAINT ck_flywheel_settlement_item_classification
        CHECK (
            (
                settled_amount = source_released_amount
                AND
                reconciliation_status = 'SETTLED'
            )
            OR
            (
                settled_amount > 0
                AND
                settled_amount < source_released_amount
                AND
                reconciliation_status = 'PARTIAL'
            )
            OR
            (
                settled_amount = 0
                AND
                reconciliation_status = 'UNRESOLVED'
            )
        ),

    CONSTRAINT ck_flywheel_settlement_positive_evidence
        CHECK (
            settled_amount = 0
            OR (
                evidence_reference IS NOT NULL
                AND
                length(btrim(evidence_reference)) > 0
            )
        ),

    CONSTRAINT ck_flywheel_settlement_note
        CHECK (
            length(btrim(evidence_note)) > 0
        )
);


CREATE INDEX idx_flywheel_settlement_case_status
    ON procurement_flywheel_settlement_cases (
        status,
        fiscal_year,
        currency
    );

CREATE INDEX idx_flywheel_settlement_item_case
    ON procurement_flywheel_settlement_items (
        settlement_case_id,
        reconciliation_status
    );

CREATE INDEX idx_flywheel_settlement_release_item
    ON procurement_flywheel_settlement_items (
        release_item_id
    );


CREATE TABLE procurement_flywheel_settlement_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number VARCHAR(60) NOT NULL,

    settlement_case_id UUID NOT NULL,
    reconciliation_number VARCHAR(60) NOT NULL,

    release_batch_id UUID NOT NULL,
    release_number VARCHAR(60) NOT NULL,

    case_status VARCHAR(30) NOT NULL,

    currency VARCHAR(3) NOT NULL,
    fiscal_year INTEGER NOT NULL,

    source_released_amount NUMERIC(20, 2) NOT NULL,
    settled_amount NUMERIC(20, 2) NOT NULL,
    variance_amount NUMERIC(20, 2) NOT NULL,

    settlement_pct NUMERIC(9, 2) NOT NULL,

    item_count INTEGER NOT NULL,

    settled_count INTEGER NOT NULL,
    partial_count INTEGER NOT NULL,
    unresolved_count INTEGER NOT NULL,

    captured_by_user_id UUID NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,

    sealed BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_flywheel_settlement_snapshot_number
        UNIQUE (snapshot_number),

    CONSTRAINT fk_flywheel_settlement_snapshot_case
        FOREIGN KEY (settlement_case_id)
        REFERENCES procurement_flywheel_settlement_cases (id),

    CONSTRAINT fk_flywheel_settlement_snapshot_user
        FOREIGN KEY (captured_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_flywheel_settlement_snapshot_amounts
        CHECK (
            source_released_amount > 0
            AND
            settled_amount >= 0
            AND
            settled_amount <= source_released_amount
            AND
            variance_amount =
                source_released_amount
                - settled_amount
        ),

    CONSTRAINT ck_flywheel_settlement_snapshot_pct
        CHECK (
            settlement_pct BETWEEN 0 AND 100
        )
);


CREATE TABLE procurement_flywheel_settlement_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id UUID NOT NULL,

    release_item_id UUID NOT NULL,

    flywheel_lineage_id UUID NOT NULL,
    lineage_number VARCHAR(60) NOT NULL,

    root_target_initiative_title VARCHAR(300) NOT NULL,

    source_released_amount NUMERIC(20, 2) NOT NULL,
    settled_amount NUMERIC(20, 2) NOT NULL,
    variance_amount NUMERIC(20, 2) NOT NULL,

    reconciliation_status VARCHAR(20) NOT NULL,

    evidence_reference VARCHAR(300),
    evidence_date DATE NOT NULL,
    evidence_note VARCHAR(5000) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_flywheel_settlement_snapshot_item
        FOREIGN KEY (snapshot_id)
        REFERENCES procurement_flywheel_settlement_snapshots (id)
        ON DELETE CASCADE
);


CREATE INDEX idx_flywheel_settlement_snapshot_capture
    ON procurement_flywheel_settlement_snapshots (
        settlement_case_id,
        captured_at DESC
    );


CREATE FUNCTION procureiq_fs71_protect_case()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Settlement reconciliation history cannot be deleted';
    END IF;

    IF (
        OLD.status = 'DRAFT'
        AND
        NEW.status = 'IN_REVIEW'
    ) OR (
        OLD.status = 'IN_REVIEW'
        AND
        NEW.status = 'RECONCILED'
    ) OR (
        OLD.status = 'RECONCILED'
        AND
        NEW.status = 'CLOSED'
    ) THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION
        'Invalid settlement reconciliation transition: % to %',
        OLD.status,
        NEW.status;
END;
$$;


CREATE TRIGGER trg_fs71_protect_case
BEFORE UPDATE OR DELETE
ON procurement_flywheel_settlement_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_fs71_protect_case();


CREATE FUNCTION procureiq_fs71_protect_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Captured settlement reconciliation items are immutable';
END;
$$;


CREATE TRIGGER trg_fs71_protect_item
BEFORE UPDATE OR DELETE
ON procurement_flywheel_settlement_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_fs71_protect_item();


CREATE FUNCTION procureiq_fs71_snapshot_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF
            OLD.sealed = FALSE
            AND
            NEW.sealed = TRUE
            AND
            (
                to_jsonb(OLD) - 'sealed'
            ) = (
                to_jsonb(NEW) - 'sealed'
            )
        THEN
            RETURN NEW;
        END IF;
    END IF;

    RAISE EXCEPTION
        'Settlement snapshot evidence is immutable';
END;
$$;


CREATE TRIGGER trg_fs71_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_flywheel_settlement_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_fs71_snapshot_guard();


CREATE TRIGGER trg_fs71_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_flywheel_settlement_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_fs71_snapshot_guard();


CREATE FUNCTION procureiq_fs71_snapshot_item_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_sealed BOOLEAN;
BEGIN
    SELECT sealed
    INTO parent_sealed
    FROM procurement_flywheel_settlement_snapshots
    WHERE id = NEW.snapshot_id
    FOR UPDATE;

    IF parent_sealed IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION
            'Cannot append evidence to a sealed settlement snapshot';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_fs71_snapshot_item_insert
BEFORE INSERT
ON procurement_flywheel_settlement_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_fs71_snapshot_item_insert();


CREATE FUNCTION procureiq_fs71_validate_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    snapshot_row RECORD;
    item_totals RECORD;
BEGIN
    SELECT *
    INTO snapshot_row
    FROM procurement_flywheel_settlement_snapshots
    WHERE id = NEW.id;

    IF NOT FOUND OR snapshot_row.sealed IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION
            'Settlement snapshot must be sealed before commit';
    END IF;

    SELECT
        count(*) AS item_count,

        count(*) FILTER (
            WHERE reconciliation_status = 'SETTLED'
        ) AS settled_count,

        count(*) FILTER (
            WHERE reconciliation_status = 'PARTIAL'
        ) AS partial_count,

        count(*) FILTER (
            WHERE reconciliation_status = 'UNRESOLVED'
        ) AS unresolved_count,

        coalesce(
            sum(settled_amount),
            0
        ) AS settled_amount,

        coalesce(
            sum(variance_amount),
            0
        ) AS variance_amount

    INTO item_totals

    FROM procurement_flywheel_settlement_snapshot_items

    WHERE snapshot_id = NEW.id;

    IF
        snapshot_row.item_count <> item_totals.item_count
        OR
        snapshot_row.settled_count <> item_totals.settled_count
        OR
        snapshot_row.partial_count <> item_totals.partial_count
        OR
        snapshot_row.unresolved_count <> item_totals.unresolved_count
        OR
        snapshot_row.settled_amount <> item_totals.settled_amount
        OR
        snapshot_row.variance_amount <> item_totals.variance_amount
    THEN
        RAISE EXCEPTION
            'Settlement snapshot header does not match its items';
    END IF;

    RETURN NULL;
END;
$$;


CREATE CONSTRAINT TRIGGER trg_fs71_validate_snapshot
AFTER INSERT OR UPDATE
ON procurement_flywheel_settlement_snapshots
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION procureiq_fs71_validate_snapshot();


CREATE TRIGGER trg_audit_flywheel_settlement_cases
AFTER INSERT OR UPDATE
ON procurement_flywheel_settlement_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_flywheel_settlement_items
AFTER INSERT
ON procurement_flywheel_settlement_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_flywheel_settlement_snapshots
AFTER INSERT
ON procurement_flywheel_settlement_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
