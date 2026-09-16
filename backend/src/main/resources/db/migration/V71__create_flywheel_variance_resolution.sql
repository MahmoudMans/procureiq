CREATE SEQUENCE procurement_flywheel_variance_plan_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_flywheel_variance_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;


CREATE TABLE procurement_flywheel_variance_plans (
    id UUID PRIMARY KEY,

    plan_number VARCHAR(60) NOT NULL,

    settlement_case_id UUID NOT NULL,
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

    source_variance_amount NUMERIC(20, 2) NOT NULL,

    plan_owner_user_id UUID NOT NULL,
    plan_owner_name_snapshot VARCHAR(300) NOT NULL,

    resolution_objective VARCHAR(5000) NOT NULL,

    status VARCHAR(30) NOT NULL,

    submitted_by_user_id UUID,
    submitted_at TIMESTAMPTZ,

    approved_by_user_id UUID,
    approved_at TIMESTAMPTZ,
    approval_note VARCHAR(5000),

    closed_by_user_id UUID,
    closed_at TIMESTAMPTZ,
    close_note VARCHAR(5000),

    created_by_user_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT uk_flywheel_variance_plan_number
        UNIQUE (plan_number),

    CONSTRAINT uk_flywheel_variance_settlement_case
        UNIQUE (settlement_case_id),

    CONSTRAINT fk_flywheel_variance_settlement_case
        FOREIGN KEY (settlement_case_id)
        REFERENCES procurement_flywheel_settlement_cases (id),

    CONSTRAINT fk_flywheel_variance_release_batch
        FOREIGN KEY (release_batch_id)
        REFERENCES procurement_flywheel_release_batches (id),

    CONSTRAINT fk_flywheel_variance_allocation_mandate
        FOREIGN KEY (allocation_mandate_id)
        REFERENCES procurement_flywheel_allocation_mandates (id),

    CONSTRAINT fk_flywheel_variance_strategy
        FOREIGN KEY (strategy_portfolio_id)
        REFERENCES procurement_flywheel_strategy_portfolios (id),

    CONSTRAINT fk_flywheel_variance_owner
        FOREIGN KEY (plan_owner_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_variance_submitter
        FOREIGN KEY (submitted_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_variance_approver
        FOREIGN KEY (approved_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_variance_closer
        FOREIGN KEY (closed_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_flywheel_variance_creator
        FOREIGN KEY (created_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_flywheel_variance_currency
        CHECK (
            currency ~ '^[A-Z]{3}$'
        ),

    CONSTRAINT ck_flywheel_variance_fiscal_year
        CHECK (
            fiscal_year BETWEEN 2000 AND 2200
        ),

    CONSTRAINT ck_flywheel_variance_source_amount
        CHECK (
            source_variance_amount > 0
        ),

    CONSTRAINT ck_flywheel_variance_plan_status
        CHECK (
            status IN (
                'DRAFT',
                'IN_REVIEW',
                'APPROVED',
                'CLOSED'
            )
        )
);


CREATE TABLE procurement_flywheel_variance_items (
    id UUID PRIMARY KEY,

    variance_plan_id UUID NOT NULL,

    settlement_item_id UUID NOT NULL,

    release_item_id UUID NOT NULL,
    allocation_item_id UUID NOT NULL,

    flywheel_lineage_id UUID NOT NULL,
    lineage_number VARCHAR(60) NOT NULL,

    root_target_initiative_title VARCHAR(300) NOT NULL,

    source_released_amount NUMERIC(20, 2) NOT NULL,
    source_settled_amount NUMERIC(20, 2) NOT NULL,
    source_variance_amount NUMERIC(20, 2) NOT NULL,

    source_reconciliation_status VARCHAR(20) NOT NULL,

    decision VARCHAR(20) NOT NULL,

    decision_rationale VARCHAR(5000) NOT NULL,

    target_date DATE NOT NULL,

    added_by_user_id UUID NOT NULL,
    added_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT uk_flywheel_variance_plan_item
        UNIQUE (
            variance_plan_id,
            settlement_item_id
        ),

    CONSTRAINT uk_flywheel_variance_settlement_item
        UNIQUE (
            settlement_item_id
        ),

    CONSTRAINT fk_flywheel_variance_item_plan
        FOREIGN KEY (variance_plan_id)
        REFERENCES procurement_flywheel_variance_plans (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_flywheel_variance_item_settlement
        FOREIGN KEY (settlement_item_id)
        REFERENCES procurement_flywheel_settlement_items (id),

    CONSTRAINT fk_flywheel_variance_item_release
        FOREIGN KEY (release_item_id)
        REFERENCES procurement_flywheel_release_items (id),

    CONSTRAINT fk_flywheel_variance_item_allocation
        FOREIGN KEY (allocation_item_id)
        REFERENCES procurement_flywheel_allocation_items (id),

    CONSTRAINT fk_flywheel_variance_item_lineage
        FOREIGN KEY (flywheel_lineage_id)
        REFERENCES procurement_capital_flywheel_lineages (id),

    CONSTRAINT fk_flywheel_variance_item_adder
        FOREIGN KEY (added_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_flywheel_variance_item_amounts
        CHECK (
            source_released_amount > 0
            AND
            source_settled_amount >= 0
            AND
            source_settled_amount
                < source_released_amount
            AND
            source_variance_amount
                = source_released_amount
                  - source_settled_amount
            AND
            source_variance_amount > 0
        ),

    CONSTRAINT ck_flywheel_variance_source_status
        CHECK (
            source_reconciliation_status IN (
                'PARTIAL',
                'UNRESOLVED'
            )
        ),

    CONSTRAINT ck_flywheel_variance_decision
        CHECK (
            decision IN (
                'RECOVER',
                'WRITE_OFF',
                'INVESTIGATE'
            )
        ),

    CONSTRAINT ck_flywheel_variance_rationale
        CHECK (
            length(
                btrim(
                    decision_rationale
                )
            ) > 0
        )
);


CREATE INDEX idx_flywheel_variance_plan_status
    ON procurement_flywheel_variance_plans (
        status,
        fiscal_year,
        currency
    );

CREATE INDEX idx_flywheel_variance_plan_items
    ON procurement_flywheel_variance_items (
        variance_plan_id,
        decision,
        target_date
    );


CREATE TABLE procurement_flywheel_variance_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number VARCHAR(60) NOT NULL,

    variance_plan_id UUID NOT NULL,
    plan_number VARCHAR(60) NOT NULL,

    settlement_case_id UUID NOT NULL,
    reconciliation_number VARCHAR(60) NOT NULL,

    plan_status VARCHAR(30) NOT NULL,

    currency VARCHAR(3) NOT NULL,
    fiscal_year INTEGER NOT NULL,

    source_variance_amount NUMERIC(20, 2) NOT NULL,

    governed_amount NUMERIC(20, 2) NOT NULL,
    recover_amount NUMERIC(20, 2) NOT NULL,
    write_off_amount NUMERIC(20, 2) NOT NULL,
    investigation_amount NUMERIC(20, 2) NOT NULL,

    coverage_pct NUMERIC(9, 2) NOT NULL,

    item_count INTEGER NOT NULL,
    recover_count INTEGER NOT NULL,
    write_off_count INTEGER NOT NULL,
    investigation_count INTEGER NOT NULL,

    captured_by_user_id UUID NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,

    sealed BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_flywheel_variance_snapshot_number
        UNIQUE (snapshot_number),

    CONSTRAINT fk_flywheel_variance_snapshot_plan
        FOREIGN KEY (variance_plan_id)
        REFERENCES procurement_flywheel_variance_plans (id),

    CONSTRAINT fk_flywheel_variance_snapshot_user
        FOREIGN KEY (captured_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_flywheel_variance_snapshot_amounts
        CHECK (
            source_variance_amount > 0
            AND
            governed_amount >= 0
            AND
            recover_amount >= 0
            AND
            write_off_amount >= 0
            AND
            investigation_amount >= 0
            AND
            governed_amount =
                recover_amount
                + write_off_amount
                + investigation_amount
            AND
            governed_amount
                <= source_variance_amount
        ),

    CONSTRAINT ck_flywheel_variance_snapshot_coverage
        CHECK (
            coverage_pct BETWEEN 0 AND 100
        )
);


CREATE TABLE procurement_flywheel_variance_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id UUID NOT NULL,

    settlement_item_id UUID NOT NULL,

    flywheel_lineage_id UUID NOT NULL,
    lineage_number VARCHAR(60) NOT NULL,

    root_target_initiative_title VARCHAR(300) NOT NULL,

    source_variance_amount NUMERIC(20, 2) NOT NULL,

    decision VARCHAR(20) NOT NULL,

    decision_rationale VARCHAR(5000) NOT NULL,

    target_date DATE NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_flywheel_variance_snapshot_item
        FOREIGN KEY (snapshot_id)
        REFERENCES procurement_flywheel_variance_snapshots (id)
        ON DELETE CASCADE
);


CREATE INDEX idx_flywheel_variance_snapshot_capture
    ON procurement_flywheel_variance_snapshots (
        variance_plan_id,
        captured_at DESC
    );


CREATE FUNCTION procureiq_fv73_validate_plan_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    source_case RECORD;

    positive_variance NUMERIC(20, 2);
BEGIN
    SELECT
        reconciliation_number,
        release_batch_id,
        release_number,
        allocation_mandate_id,
        allocation_mandate_number,
        strategy_portfolio_id,
        strategy_portfolio_number,
        currency,
        fiscal_year,
        status

    INTO source_case

    FROM procurement_flywheel_settlement_cases

    WHERE id = NEW.settlement_case_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source settlement reconciliation case does not exist';
    END IF;

    IF source_case.status NOT IN (
        'RECONCILED',
        'CLOSED'
    ) THEN
        RAISE EXCEPTION
            'Variance governance requires a RECONCILED or CLOSED settlement case';
    END IF;

    SELECT
        coalesce(
            sum(
                variance_amount
            ),
            0
        )

    INTO positive_variance

    FROM procurement_flywheel_settlement_items

    WHERE settlement_case_id =
        NEW.settlement_case_id

    AND variance_amount > 0;

    IF positive_variance <= 0 THEN
        RAISE EXCEPTION
            'Settlement case contains no positive variance';
    END IF;

    IF
        NEW.reconciliation_number
            IS DISTINCT FROM
            source_case.reconciliation_number

        OR

        NEW.release_batch_id
            IS DISTINCT FROM
            source_case.release_batch_id

        OR

        NEW.release_number
            IS DISTINCT FROM
            source_case.release_number

        OR

        NEW.allocation_mandate_id
            IS DISTINCT FROM
            source_case.allocation_mandate_id

        OR

        NEW.allocation_mandate_number
            IS DISTINCT FROM
            source_case.allocation_mandate_number

        OR

        NEW.strategy_portfolio_id
            IS DISTINCT FROM
            source_case.strategy_portfolio_id

        OR

        NEW.strategy_portfolio_number
            IS DISTINCT FROM
            source_case.strategy_portfolio_number

        OR

        NEW.currency
            IS DISTINCT FROM
            source_case.currency

        OR

        NEW.fiscal_year
            IS DISTINCT FROM
            source_case.fiscal_year

        OR

        NEW.source_variance_amount
            IS DISTINCT FROM
            positive_variance
    THEN
        RAISE EXCEPTION
            'Variance plan does not match settlement authority';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_fv73_validate_plan_insert
BEFORE INSERT
ON procurement_flywheel_variance_plans
FOR EACH ROW
EXECUTE FUNCTION procureiq_fv73_validate_plan_insert();


CREATE FUNCTION procureiq_fv73_validate_item_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    source_plan RECORD;
    source_item RECORD;
BEGIN
    SELECT
        settlement_case_id,
        status

    INTO source_plan

    FROM procurement_flywheel_variance_plans

    WHERE id = NEW.variance_plan_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Variance plan does not exist';
    END IF;

    IF source_plan.status <> 'DRAFT' THEN
        RAISE EXCEPTION
            'Variance decisions can be added only while the plan is DRAFT';
    END IF;

    SELECT
        settlement_case_id,
        release_item_id,
        allocation_item_id,
        flywheel_lineage_id,
        lineage_number,
        root_target_initiative_title,
        source_released_amount,
        settled_amount,
        variance_amount,
        reconciliation_status

    INTO source_item

    FROM procurement_flywheel_settlement_items

    WHERE id = NEW.settlement_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source settlement item does not exist';
    END IF;

    IF
        source_item.settlement_case_id
            IS DISTINCT FROM
            source_plan.settlement_case_id

        OR

        source_item.variance_amount <= 0

        OR

        source_item.reconciliation_status NOT IN (
            'PARTIAL',
            'UNRESOLVED'
        )
    THEN
        RAISE EXCEPTION
            'Settlement item is not eligible for variance governance';
    END IF;

    IF
        NEW.release_item_id
            IS DISTINCT FROM
            source_item.release_item_id

        OR

        NEW.allocation_item_id
            IS DISTINCT FROM
            source_item.allocation_item_id

        OR

        NEW.flywheel_lineage_id
            IS DISTINCT FROM
            source_item.flywheel_lineage_id

        OR

        NEW.lineage_number
            IS DISTINCT FROM
            source_item.lineage_number

        OR

        NEW.root_target_initiative_title
            IS DISTINCT FROM
            source_item.root_target_initiative_title

        OR

        NEW.source_released_amount
            IS DISTINCT FROM
            source_item.source_released_amount

        OR

        NEW.source_settled_amount
            IS DISTINCT FROM
            source_item.settled_amount

        OR

        NEW.source_variance_amount
            IS DISTINCT FROM
            source_item.variance_amount

        OR

        NEW.source_reconciliation_status
            IS DISTINCT FROM
            source_item.reconciliation_status
    THEN
        RAISE EXCEPTION
            'Variance decision does not match settlement-item authority';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_fv73_validate_item_insert
BEFORE INSERT
ON procurement_flywheel_variance_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_fv73_validate_item_insert();


CREATE FUNCTION procureiq_fv73_protect_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Captured variance decisions are immutable';
END;
$$;


CREATE TRIGGER trg_fv73_protect_item
BEFORE UPDATE OR DELETE
ON procurement_flywheel_variance_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_fv73_protect_item();


CREATE FUNCTION procureiq_fv73_validate_completeness(
    requested_plan_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    plan_row RECORD;

    source_status TEXT;

    source_count BIGINT;
    plan_count BIGINT;

    source_amount NUMERIC(20, 2);
    plan_amount NUMERIC(20, 2);
BEGIN
    SELECT *
    INTO plan_row
    FROM procurement_flywheel_variance_plans
    WHERE id = requested_plan_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Variance plan does not exist';
    END IF;

    SELECT status
    INTO source_status
    FROM procurement_flywheel_settlement_cases
    WHERE id = plan_row.settlement_case_id;

    IF source_status NOT IN (
        'RECONCILED',
        'CLOSED'
    ) THEN
        RAISE EXCEPTION
            'Settlement authority is no longer finalized';
    END IF;

    SELECT
        count(*),
        coalesce(
            sum(
                variance_amount
            ),
            0
        )

    INTO
        source_count,
        source_amount

    FROM procurement_flywheel_settlement_items

    WHERE settlement_case_id =
        plan_row.settlement_case_id

    AND variance_amount > 0;

    SELECT
        count(*),
        coalesce(
            sum(
                source_variance_amount
            ),
            0
        )

    INTO
        plan_count,
        plan_amount

    FROM procurement_flywheel_variance_items

    WHERE variance_plan_id =
        requested_plan_id;

    IF
        source_count = 0

        OR

        source_count
            <> plan_count

        OR

        source_amount
            <> plan_amount

        OR

        plan_row.source_variance_amount
            <> source_amount
    THEN
        RAISE EXCEPTION
            'Every positive settlement variance requires one governed treatment';
    END IF;
END;
$$;


CREATE FUNCTION procureiq_fv73_protect_plan()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Variance governance history cannot be deleted';
    END IF;


    IF (
        OLD.status = 'DRAFT'
        AND
        NEW.status = 'IN_REVIEW'
    ) THEN
        IF (
            to_jsonb(NEW)
                - ARRAY[
                    'status',
                    'submitted_by_user_id',
                    'submitted_at',
                    'updated_at',
                    'version'
                ]
        ) IS DISTINCT FROM (
            to_jsonb(OLD)
                - ARRAY[
                    'status',
                    'submitted_by_user_id',
                    'submitted_at',
                    'updated_at',
                    'version'
                ]
        ) THEN
            RAISE EXCEPTION
                'Variance-plan authority cannot change during review submission';
        END IF;

        IF
            NEW.submitted_by_user_id IS NULL
            OR
            NEW.submitted_at IS NULL
            OR
            NEW.version <> OLD.version + 1
        THEN
            RAISE EXCEPTION
                'Variance review submission evidence is incomplete';
        END IF;

        PERFORM procureiq_fv73_validate_completeness(
            NEW.id
        );

        RETURN NEW;
    END IF;


    IF (
        OLD.status = 'IN_REVIEW'
        AND
        NEW.status = 'APPROVED'
    ) THEN
        IF (
            to_jsonb(NEW)
                - ARRAY[
                    'status',
                    'approval_note',
                    'approved_by_user_id',
                    'approved_at',
                    'updated_at',
                    'version'
                ]
        ) IS DISTINCT FROM (
            to_jsonb(OLD)
                - ARRAY[
                    'status',
                    'approval_note',
                    'approved_by_user_id',
                    'approved_at',
                    'updated_at',
                    'version'
                ]
        ) THEN
            RAISE EXCEPTION
                'Variance-plan authority cannot change during approval';
        END IF;

        IF
            NEW.approved_by_user_id IS NULL
            OR
            NEW.approved_at IS NULL
            OR
            NEW.approval_note IS NULL
            OR
            length(
                btrim(
                    NEW.approval_note
                )
            ) = 0
            OR
            NEW.version <> OLD.version + 1
        THEN
            RAISE EXCEPTION
                'Variance-plan approval evidence is incomplete';
        END IF;

        PERFORM procureiq_fv73_validate_completeness(
            NEW.id
        );

        RETURN NEW;
    END IF;


    IF (
        OLD.status = 'APPROVED'
        AND
        NEW.status = 'CLOSED'
    ) THEN
        IF (
            to_jsonb(NEW)
                - ARRAY[
                    'status',
                    'close_note',
                    'closed_by_user_id',
                    'closed_at',
                    'updated_at',
                    'version'
                ]
        ) IS DISTINCT FROM (
            to_jsonb(OLD)
                - ARRAY[
                    'status',
                    'close_note',
                    'closed_by_user_id',
                    'closed_at',
                    'updated_at',
                    'version'
                ]
        ) THEN
            RAISE EXCEPTION
                'Variance-plan authority cannot change during closure';
        END IF;

        IF
            NEW.closed_by_user_id IS NULL
            OR
            NEW.closed_at IS NULL
            OR
            NEW.close_note IS NULL
            OR
            length(
                btrim(
                    NEW.close_note
                )
            ) = 0
            OR
            NEW.version <> OLD.version + 1
        THEN
            RAISE EXCEPTION
                'Variance-plan closure evidence is incomplete';
        END IF;

        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Invalid variance-plan transition: % to %',
        OLD.status,
        NEW.status;
END;
$$;


CREATE TRIGGER trg_fv73_protect_plan
BEFORE UPDATE OR DELETE
ON procurement_flywheel_variance_plans
FOR EACH ROW
EXECUTE FUNCTION procureiq_fv73_protect_plan();


CREATE FUNCTION procureiq_fv73_snapshot_guard()
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
                to_jsonb(OLD)
                - 'sealed'
            ) = (
                to_jsonb(NEW)
                - 'sealed'
            )
        THEN
            RETURN NEW;
        END IF;
    END IF;

    RAISE EXCEPTION
        'Variance snapshot evidence is immutable';
END;
$$;


CREATE TRIGGER trg_fv73_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_flywheel_variance_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_fv73_snapshot_guard();


CREATE TRIGGER trg_fv73_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_flywheel_variance_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_fv73_snapshot_guard();


CREATE FUNCTION procureiq_fv73_snapshot_item_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_sealed BOOLEAN;
BEGIN
    SELECT sealed
    INTO parent_sealed
    FROM procurement_flywheel_variance_snapshots
    WHERE id = NEW.snapshot_id
    FOR UPDATE;

    IF parent_sealed IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION
            'Cannot append items to a sealed variance snapshot';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_fv73_snapshot_item_insert
BEFORE INSERT
ON procurement_flywheel_variance_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_fv73_snapshot_item_insert();


CREATE FUNCTION procureiq_fv73_validate_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    snapshot_row RECORD;
    totals RECORD;
BEGIN
    SELECT *
    INTO snapshot_row
    FROM procurement_flywheel_variance_snapshots
    WHERE id = NEW.id;

    IF
        NOT FOUND
        OR
        snapshot_row.sealed IS DISTINCT FROM TRUE
    THEN
        RAISE EXCEPTION
            'Variance snapshot must be sealed before commit';
    END IF;

    SELECT
        count(*) AS item_count,

        count(*) FILTER (
            WHERE decision = 'RECOVER'
        ) AS recover_count,

        count(*) FILTER (
            WHERE decision = 'WRITE_OFF'
        ) AS write_off_count,

        count(*) FILTER (
            WHERE decision = 'INVESTIGATE'
        ) AS investigation_count,

        coalesce(
            sum(
                source_variance_amount
            ),
            0
        ) AS governed_amount,

        coalesce(
            sum(
                source_variance_amount
            ) FILTER (
                WHERE decision = 'RECOVER'
            ),
            0
        ) AS recover_amount,

        coalesce(
            sum(
                source_variance_amount
            ) FILTER (
                WHERE decision = 'WRITE_OFF'
            ),
            0
        ) AS write_off_amount,

        coalesce(
            sum(
                source_variance_amount
            ) FILTER (
                WHERE decision = 'INVESTIGATE'
            ),
            0
        ) AS investigation_amount

    INTO totals

    FROM procurement_flywheel_variance_snapshot_items

    WHERE snapshot_id = NEW.id;

    IF
        snapshot_row.item_count
            <> totals.item_count

        OR

        snapshot_row.recover_count
            <> totals.recover_count

        OR

        snapshot_row.write_off_count
            <> totals.write_off_count

        OR

        snapshot_row.investigation_count
            <> totals.investigation_count

        OR

        snapshot_row.governed_amount
            <> totals.governed_amount

        OR

        snapshot_row.recover_amount
            <> totals.recover_amount

        OR

        snapshot_row.write_off_amount
            <> totals.write_off_amount

        OR

        snapshot_row.investigation_amount
            <> totals.investigation_amount
    THEN
        RAISE EXCEPTION
            'Variance snapshot header does not match captured decisions';
    END IF;

    RETURN NULL;
END;
$$;


CREATE CONSTRAINT TRIGGER trg_fv73_validate_snapshot
AFTER INSERT OR UPDATE
ON procurement_flywheel_variance_snapshots
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION procureiq_fv73_validate_snapshot();


CREATE TRIGGER trg_audit_flywheel_variance_plans
AFTER INSERT OR UPDATE
ON procurement_flywheel_variance_plans
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_flywheel_variance_items
AFTER INSERT
ON procurement_flywheel_variance_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_flywheel_variance_snapshots
AFTER INSERT
ON procurement_flywheel_variance_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
