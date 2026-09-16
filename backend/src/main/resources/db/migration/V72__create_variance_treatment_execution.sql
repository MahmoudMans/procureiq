CREATE SEQUENCE procurement_variance_execution_case_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_variance_execution_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;


CREATE TABLE procurement_variance_execution_cases (
    id UUID PRIMARY KEY,

    execution_number VARCHAR(60) NOT NULL,

    variance_plan_id UUID NOT NULL,
    variance_plan_number VARCHAR(60) NOT NULL,

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

    source_recover_amount NUMERIC(20, 2) NOT NULL,
    source_write_off_amount NUMERIC(20, 2) NOT NULL,
    source_investigation_amount NUMERIC(20, 2) NOT NULL,

    execution_owner_user_id UUID NOT NULL,
    execution_owner_name_snapshot VARCHAR(300) NOT NULL,

    execution_objective VARCHAR(5000) NOT NULL,

    status VARCHAR(30) NOT NULL,

    submitted_by_user_id UUID,
    submitted_at TIMESTAMPTZ,

    verified_by_user_id UUID,
    verified_at TIMESTAMPTZ,
    verification_note VARCHAR(5000),

    closed_by_user_id UUID,
    closed_at TIMESTAMPTZ,
    close_note VARCHAR(5000),

    created_by_user_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT uk_variance_execution_case_number
        UNIQUE (execution_number),

    CONSTRAINT uk_variance_execution_plan
        UNIQUE (variance_plan_id),

    CONSTRAINT fk_variance_execution_plan
        FOREIGN KEY (variance_plan_id)
        REFERENCES procurement_flywheel_variance_plans (id),

    CONSTRAINT fk_variance_execution_settlement
        FOREIGN KEY (settlement_case_id)
        REFERENCES procurement_flywheel_settlement_cases (id),

    CONSTRAINT fk_variance_execution_release
        FOREIGN KEY (release_batch_id)
        REFERENCES procurement_flywheel_release_batches (id),

    CONSTRAINT fk_variance_execution_mandate
        FOREIGN KEY (allocation_mandate_id)
        REFERENCES procurement_flywheel_allocation_mandates (id),

    CONSTRAINT fk_variance_execution_strategy
        FOREIGN KEY (strategy_portfolio_id)
        REFERENCES procurement_flywheel_strategy_portfolios (id),

    CONSTRAINT fk_variance_execution_owner
        FOREIGN KEY (execution_owner_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_variance_execution_submitter
        FOREIGN KEY (submitted_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_variance_execution_verifier
        FOREIGN KEY (verified_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_variance_execution_closer
        FOREIGN KEY (closed_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT fk_variance_execution_creator
        FOREIGN KEY (created_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_variance_execution_currency
        CHECK (
            currency ~ '^[A-Z]{3}$'
        ),

    CONSTRAINT ck_variance_execution_fiscal_year
        CHECK (
            fiscal_year BETWEEN 2000 AND 2200
        ),

    CONSTRAINT ck_variance_execution_source_amounts
        CHECK (
            source_variance_amount > 0

            AND
            source_recover_amount >= 0

            AND
            source_write_off_amount >= 0

            AND
            source_investigation_amount >= 0

            AND
            source_variance_amount =
                source_recover_amount
                + source_write_off_amount
                + source_investigation_amount
        ),

    CONSTRAINT ck_variance_execution_case_status
        CHECK (
            status IN (
                'DRAFT',
                'IN_REVIEW',
                'VERIFIED',
                'CLOSED'
            )
        )
);


CREATE TABLE procurement_variance_execution_items (
    id UUID PRIMARY KEY,

    execution_case_id UUID NOT NULL,

    variance_item_id UUID NOT NULL,

    settlement_item_id UUID NOT NULL,

    release_item_id UUID NOT NULL,
    allocation_item_id UUID NOT NULL,

    flywheel_lineage_id UUID NOT NULL,
    lineage_number VARCHAR(60) NOT NULL,

    root_target_initiative_title VARCHAR(300) NOT NULL,

    source_variance_amount NUMERIC(20, 2) NOT NULL,

    source_decision VARCHAR(20) NOT NULL,

    executed_amount NUMERIC(20, 2) NOT NULL,

    outcome VARCHAR(20) NOT NULL,

    evidence_reference VARCHAR(300),

    evidence_date DATE NOT NULL,

    evidence_note VARCHAR(5000) NOT NULL,

    added_by_user_id UUID NOT NULL,
    added_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT uk_variance_execution_case_item
        UNIQUE (
            execution_case_id,
            variance_item_id
        ),

    CONSTRAINT uk_variance_execution_variance_item
        UNIQUE (
            variance_item_id
        ),

    CONSTRAINT fk_variance_execution_item_case
        FOREIGN KEY (execution_case_id)
        REFERENCES procurement_variance_execution_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_variance_execution_item_source
        FOREIGN KEY (variance_item_id)
        REFERENCES procurement_flywheel_variance_items (id),

    CONSTRAINT fk_variance_execution_item_settlement
        FOREIGN KEY (settlement_item_id)
        REFERENCES procurement_flywheel_settlement_items (id),

    CONSTRAINT fk_variance_execution_item_release
        FOREIGN KEY (release_item_id)
        REFERENCES procurement_flywheel_release_items (id),

    CONSTRAINT fk_variance_execution_item_allocation
        FOREIGN KEY (allocation_item_id)
        REFERENCES procurement_flywheel_allocation_items (id),

    CONSTRAINT fk_variance_execution_item_lineage
        FOREIGN KEY (flywheel_lineage_id)
        REFERENCES procurement_capital_flywheel_lineages (id),

    CONSTRAINT fk_variance_execution_item_user
        FOREIGN KEY (added_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_variance_execution_source_variance
        CHECK (
            source_variance_amount > 0
        ),

    CONSTRAINT ck_variance_execution_source_decision
        CHECK (
            source_decision IN (
                'RECOVER',
                'WRITE_OFF',
                'INVESTIGATE'
            )
        ),

    CONSTRAINT ck_variance_execution_outcome
        CHECK (
            outcome IN (
                'COMPLETED',
                'PARTIAL',
                'UNRESOLVED'
            )
        ),

    CONSTRAINT ck_variance_execution_amount
        CHECK (
            executed_amount >= 0
            AND
            executed_amount <= source_variance_amount
        ),

    CONSTRAINT ck_variance_execution_treatment_rules
        CHECK (
            (
                source_decision IN (
                    'RECOVER',
                    'WRITE_OFF'
                )

                AND

                (
                    (
                        outcome = 'COMPLETED'
                        AND
                        executed_amount = source_variance_amount
                    )

                    OR

                    (
                        outcome = 'PARTIAL'
                        AND
                        executed_amount > 0
                        AND
                        executed_amount < source_variance_amount
                    )

                    OR

                    (
                        outcome = 'UNRESOLVED'
                        AND
                        executed_amount = 0
                    )
                )
            )

            OR

            (
                source_decision = 'INVESTIGATE'

                AND
                executed_amount = 0

                AND
                outcome IN (
                    'COMPLETED',
                    'UNRESOLVED'
                )
            )
        ),

    CONSTRAINT ck_variance_execution_positive_reference
        CHECK (
            executed_amount = 0

            OR

            (
                evidence_reference IS NOT NULL
                AND
                length(
                    btrim(
                        evidence_reference
                    )
                ) > 0
            )
        ),

    CONSTRAINT ck_variance_execution_evidence_note
        CHECK (
            length(
                btrim(
                    evidence_note
                )
            ) > 0
        )
);


CREATE INDEX idx_variance_execution_case_status
    ON procurement_variance_execution_cases (
        status,
        fiscal_year,
        currency
    );

CREATE INDEX idx_variance_execution_items
    ON procurement_variance_execution_items (
        execution_case_id,
        source_decision,
        outcome
    );


CREATE TABLE procurement_variance_execution_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number VARCHAR(60) NOT NULL,

    execution_case_id UUID NOT NULL,
    execution_number VARCHAR(60) NOT NULL,

    variance_plan_id UUID NOT NULL,
    variance_plan_number VARCHAR(60) NOT NULL,

    case_status VARCHAR(30) NOT NULL,

    currency VARCHAR(3) NOT NULL,
    fiscal_year INTEGER NOT NULL,

    source_variance_amount NUMERIC(20, 2) NOT NULL,

    captured_variance_amount NUMERIC(20, 2) NOT NULL,

    executed_financial_amount NUMERIC(20, 2) NOT NULL,

    recovered_amount NUMERIC(20, 2) NOT NULL,

    written_off_amount NUMERIC(20, 2) NOT NULL,

    completed_investigation_amount NUMERIC(20, 2) NOT NULL,

    open_exposure_amount NUMERIC(20, 2) NOT NULL,

    completion_pct NUMERIC(9, 2) NOT NULL,

    item_count INTEGER NOT NULL,

    completed_count INTEGER NOT NULL,
    partial_count INTEGER NOT NULL,
    unresolved_count INTEGER NOT NULL,

    captured_by_user_id UUID NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,

    sealed BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uk_variance_execution_snapshot_number
        UNIQUE (snapshot_number),

    CONSTRAINT fk_variance_execution_snapshot_case
        FOREIGN KEY (execution_case_id)
        REFERENCES procurement_variance_execution_cases (id),

    CONSTRAINT fk_variance_execution_snapshot_user
        FOREIGN KEY (captured_by_user_id)
        REFERENCES app_users (id),

    CONSTRAINT ck_variance_execution_snapshot_amounts
        CHECK (
            source_variance_amount > 0

            AND
            captured_variance_amount >= 0

            AND
            executed_financial_amount >= 0

            AND
            recovered_amount >= 0

            AND
            written_off_amount >= 0

            AND
            completed_investigation_amount >= 0

            AND
            open_exposure_amount >= 0

            AND
            captured_variance_amount <= source_variance_amount

            AND
            executed_financial_amount =
                recovered_amount
                + written_off_amount

            AND
            open_exposure_amount <= source_variance_amount
        ),

    CONSTRAINT ck_variance_execution_snapshot_pct
        CHECK (
            completion_pct BETWEEN 0 AND 100
        )
);


CREATE TABLE procurement_variance_execution_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id UUID NOT NULL,

    variance_item_id UUID NOT NULL,

    flywheel_lineage_id UUID NOT NULL,
    lineage_number VARCHAR(60) NOT NULL,

    root_target_initiative_title VARCHAR(300) NOT NULL,

    source_variance_amount NUMERIC(20, 2) NOT NULL,

    source_decision VARCHAR(20) NOT NULL,

    executed_amount NUMERIC(20, 2) NOT NULL,

    outcome VARCHAR(20) NOT NULL,

    evidence_reference VARCHAR(300),

    evidence_date DATE NOT NULL,

    evidence_note VARCHAR(5000) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_variance_execution_snapshot_item
        FOREIGN KEY (snapshot_id)
        REFERENCES procurement_variance_execution_snapshots (id)
        ON DELETE CASCADE
);


CREATE INDEX idx_variance_execution_snapshot_capture
    ON procurement_variance_execution_snapshots (
        execution_case_id,
        captured_at DESC
    );


CREATE FUNCTION procureiq_fve74_validate_case_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    source_plan RECORD;

    decision_total NUMERIC(20, 2);
    recover_total NUMERIC(20, 2);
    write_off_total NUMERIC(20, 2);
    investigation_total NUMERIC(20, 2);
BEGIN
    SELECT
        plan_number,
        settlement_case_id,
        reconciliation_number,
        release_batch_id,
        release_number,
        allocation_mandate_id,
        allocation_mandate_number,
        strategy_portfolio_id,
        strategy_portfolio_number,
        currency,
        fiscal_year,
        source_variance_amount,
        status

    INTO source_plan

    FROM procurement_flywheel_variance_plans

    WHERE id = NEW.variance_plan_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source variance plan does not exist';
    END IF;

    IF source_plan.status NOT IN (
        'APPROVED',
        'CLOSED'
    ) THEN
        RAISE EXCEPTION
            'Treatment execution requires an APPROVED or CLOSED variance plan';
    END IF;

    SELECT
        coalesce(
            sum(
                source_variance_amount
            ),
            0
        ),

        coalesce(
            sum(
                source_variance_amount
            ) FILTER (
                WHERE decision = 'RECOVER'
            ),
            0
        ),

        coalesce(
            sum(
                source_variance_amount
            ) FILTER (
                WHERE decision = 'WRITE_OFF'
            ),
            0
        ),

        coalesce(
            sum(
                source_variance_amount
            ) FILTER (
                WHERE decision = 'INVESTIGATE'
            ),
            0
        )

    INTO
        decision_total,
        recover_total,
        write_off_total,
        investigation_total

    FROM procurement_flywheel_variance_items

    WHERE variance_plan_id =
        NEW.variance_plan_id;

    IF
        decision_total <= 0

        OR

        decision_total
            <> source_plan.source_variance_amount
    THEN
        RAISE EXCEPTION
            'Approved variance plan does not contain complete decision authority';
    END IF;

    IF
        NEW.variance_plan_number
            IS DISTINCT FROM
            source_plan.plan_number

        OR

        NEW.settlement_case_id
            IS DISTINCT FROM
            source_plan.settlement_case_id

        OR

        NEW.reconciliation_number
            IS DISTINCT FROM
            source_plan.reconciliation_number

        OR

        NEW.release_batch_id
            IS DISTINCT FROM
            source_plan.release_batch_id

        OR

        NEW.release_number
            IS DISTINCT FROM
            source_plan.release_number

        OR

        NEW.allocation_mandate_id
            IS DISTINCT FROM
            source_plan.allocation_mandate_id

        OR

        NEW.allocation_mandate_number
            IS DISTINCT FROM
            source_plan.allocation_mandate_number

        OR

        NEW.strategy_portfolio_id
            IS DISTINCT FROM
            source_plan.strategy_portfolio_id

        OR

        NEW.strategy_portfolio_number
            IS DISTINCT FROM
            source_plan.strategy_portfolio_number

        OR

        NEW.currency
            IS DISTINCT FROM
            source_plan.currency

        OR

        NEW.fiscal_year
            IS DISTINCT FROM
            source_plan.fiscal_year

        OR

        NEW.source_variance_amount
            IS DISTINCT FROM
            decision_total

        OR

        NEW.source_recover_amount
            IS DISTINCT FROM
            recover_total

        OR

        NEW.source_write_off_amount
            IS DISTINCT FROM
            write_off_total

        OR

        NEW.source_investigation_amount
            IS DISTINCT FROM
            investigation_total
    THEN
        RAISE EXCEPTION
            'Treatment-execution case does not match Step 73 authority';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_fve74_validate_case_insert
BEFORE INSERT
ON procurement_variance_execution_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_fve74_validate_case_insert();


CREATE FUNCTION procureiq_fve74_validate_item_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    execution_case RECORD;
    source_item RECORD;
BEGIN
    SELECT
        variance_plan_id,
        status

    INTO execution_case

    FROM procurement_variance_execution_cases

    WHERE id = NEW.execution_case_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Treatment-execution case does not exist';
    END IF;

    IF execution_case.status <> 'DRAFT' THEN
        RAISE EXCEPTION
            'Execution evidence can be inserted only while the case is DRAFT';
    END IF;

    SELECT
        variance_plan_id,
        settlement_item_id,
        release_item_id,
        allocation_item_id,
        flywheel_lineage_id,
        lineage_number,
        root_target_initiative_title,
        source_variance_amount,
        decision

    INTO source_item

    FROM procurement_flywheel_variance_items

    WHERE id = NEW.variance_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source Step 73 variance item does not exist';
    END IF;

    IF
        source_item.variance_plan_id
            IS DISTINCT FROM
            execution_case.variance_plan_id

        OR

        NEW.settlement_item_id
            IS DISTINCT FROM
            source_item.settlement_item_id

        OR

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

        NEW.source_variance_amount
            IS DISTINCT FROM
            source_item.source_variance_amount

        OR

        NEW.source_decision
            IS DISTINCT FROM
            source_item.decision
    THEN
        RAISE EXCEPTION
            'Execution evidence does not match Step 73 variance authority';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_fve74_validate_item_insert
BEFORE INSERT
ON procurement_variance_execution_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_fve74_validate_item_insert();


CREATE FUNCTION procureiq_fve74_protect_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Captured treatment-execution evidence is immutable';
END;
$$;


CREATE TRIGGER trg_fve74_protect_item
BEFORE UPDATE OR DELETE
ON procurement_variance_execution_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_fve74_protect_item();


CREATE FUNCTION procureiq_fve74_validate_completeness(
    requested_case_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    execution_case RECORD;

    plan_status TEXT;

    source_count BIGINT;
    execution_count BIGINT;

    source_amount NUMERIC(20, 2);
    execution_source_amount NUMERIC(20, 2);
BEGIN
    SELECT *
    INTO execution_case
    FROM procurement_variance_execution_cases
    WHERE id = requested_case_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Treatment-execution case does not exist';
    END IF;

    SELECT status
    INTO plan_status
    FROM procurement_flywheel_variance_plans
    WHERE id = execution_case.variance_plan_id;

    IF plan_status NOT IN (
        'APPROVED',
        'CLOSED'
    ) THEN
        RAISE EXCEPTION
            'Step 73 authority is no longer approved';
    END IF;

    SELECT
        count(*),
        coalesce(
            sum(
                source_variance_amount
            ),
            0
        )

    INTO
        source_count,
        source_amount

    FROM procurement_flywheel_variance_items

    WHERE variance_plan_id =
        execution_case.variance_plan_id;

    SELECT
        count(*),
        coalesce(
            sum(
                source_variance_amount
            ),
            0
        )

    INTO
        execution_count,
        execution_source_amount

    FROM procurement_variance_execution_items

    WHERE execution_case_id =
        requested_case_id;

    IF
        source_count = 0

        OR

        source_count <> execution_count

        OR

        source_amount <> execution_source_amount

        OR

        execution_case.source_variance_amount
            <> source_amount
    THEN
        RAISE EXCEPTION
            'Every Step 73 treatment decision requires one execution-evidence record';
    END IF;
END;
$$;


CREATE FUNCTION procureiq_fve74_protect_case()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Treatment-execution history cannot be deleted';
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
                'Treatment-execution authority cannot change during review submission';
        END IF;

        IF
            NEW.submitted_by_user_id IS NULL
            OR
            NEW.submitted_at IS NULL
            OR
            NEW.version <> OLD.version + 1
        THEN
            RAISE EXCEPTION
                'Execution review submission evidence is incomplete';
        END IF;

        PERFORM procureiq_fve74_validate_completeness(
            NEW.id
        );

        RETURN NEW;
    END IF;


    IF (
        OLD.status = 'IN_REVIEW'
        AND
        NEW.status = 'VERIFIED'
    ) THEN
        IF (
            to_jsonb(NEW)
                - ARRAY[
                    'status',
                    'verification_note',
                    'verified_by_user_id',
                    'verified_at',
                    'updated_at',
                    'version'
                ]
        ) IS DISTINCT FROM (
            to_jsonb(OLD)
                - ARRAY[
                    'status',
                    'verification_note',
                    'verified_by_user_id',
                    'verified_at',
                    'updated_at',
                    'version'
                ]
        ) THEN
            RAISE EXCEPTION
                'Treatment-execution authority cannot change during verification';
        END IF;

        IF
            NEW.verified_by_user_id IS NULL
            OR
            NEW.verified_at IS NULL
            OR
            NEW.verification_note IS NULL
            OR
            length(
                btrim(
                    NEW.verification_note
                )
            ) = 0
            OR
            NEW.version <> OLD.version + 1
        THEN
            RAISE EXCEPTION
                'Treatment verification evidence is incomplete';
        END IF;

        PERFORM procureiq_fve74_validate_completeness(
            NEW.id
        );

        RETURN NEW;
    END IF;


    IF (
        OLD.status = 'VERIFIED'
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
                'Treatment-execution authority cannot change during closure';
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
                'Treatment-execution closure evidence is incomplete';
        END IF;

        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Invalid treatment-execution transition: % to %',
        OLD.status,
        NEW.status;
END;
$$;


CREATE TRIGGER trg_fve74_protect_case
BEFORE UPDATE OR DELETE
ON procurement_variance_execution_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_fve74_protect_case();


CREATE FUNCTION procureiq_fve74_snapshot_header_guard()
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
        'Treatment-execution snapshot is immutable';
END;
$$;


CREATE TRIGGER trg_fve74_snapshot_header_immutable
BEFORE UPDATE OR DELETE
ON procurement_variance_execution_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_fve74_snapshot_header_guard();


CREATE FUNCTION procureiq_fve74_snapshot_item_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Treatment-execution snapshot items are immutable';
END;
$$;


CREATE TRIGGER trg_fve74_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_variance_execution_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_fve74_snapshot_item_guard();


CREATE FUNCTION procureiq_fve74_snapshot_item_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_sealed BOOLEAN;
BEGIN
    SELECT sealed
    INTO parent_sealed
    FROM procurement_variance_execution_snapshots
    WHERE id = NEW.snapshot_id
    FOR UPDATE;

    IF parent_sealed IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION
            'Cannot append items to a sealed treatment-execution snapshot';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_fve74_snapshot_item_insert
BEFORE INSERT
ON procurement_variance_execution_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_fve74_snapshot_item_insert();


CREATE FUNCTION procureiq_fve74_validate_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    snapshot_row RECORD;
    totals RECORD;
BEGIN
    SELECT *
    INTO snapshot_row
    FROM procurement_variance_execution_snapshots
    WHERE id = NEW.id;

    IF
        NOT FOUND
        OR
        snapshot_row.sealed IS DISTINCT FROM TRUE
    THEN
        RAISE EXCEPTION
            'Treatment-execution snapshot must be sealed before commit';
    END IF;

    SELECT
        count(*) AS item_count,

        count(*) FILTER (
            WHERE outcome = 'COMPLETED'
        ) AS completed_count,

        count(*) FILTER (
            WHERE outcome = 'PARTIAL'
        ) AS partial_count,

        count(*) FILTER (
            WHERE outcome = 'UNRESOLVED'
        ) AS unresolved_count,

        coalesce(
            sum(
                source_variance_amount
            ),
            0
        ) AS captured_variance_amount,

        coalesce(
            sum(
                executed_amount
            ) FILTER (
                WHERE source_decision IN (
                    'RECOVER',
                    'WRITE_OFF'
                )
            ),
            0
        ) AS executed_financial_amount,

        coalesce(
            sum(
                executed_amount
            ) FILTER (
                WHERE source_decision = 'RECOVER'
            ),
            0
        ) AS recovered_amount,

        coalesce(
            sum(
                executed_amount
            ) FILTER (
                WHERE source_decision = 'WRITE_OFF'
            ),
            0
        ) AS written_off_amount,

        coalesce(
            sum(
                source_variance_amount
            ) FILTER (
                WHERE source_decision = 'INVESTIGATE'
                AND outcome = 'COMPLETED'
            ),
            0
        ) AS completed_investigation_amount,

        coalesce(
            sum(
                CASE

                    WHEN source_decision IN (
                        'RECOVER',
                        'WRITE_OFF'
                    )
                    THEN
                        source_variance_amount
                        - executed_amount

                    WHEN source_decision = 'INVESTIGATE'
                    AND outcome = 'UNRESOLVED'
                    THEN
                        source_variance_amount

                    ELSE
                        0
                END
            ),
            0
        ) AS open_exposure_amount

    INTO totals

    FROM procurement_variance_execution_snapshot_items

    WHERE snapshot_id = NEW.id;

    IF
        snapshot_row.item_count
            <> totals.item_count

        OR

        snapshot_row.completed_count
            <> totals.completed_count

        OR

        snapshot_row.partial_count
            <> totals.partial_count

        OR

        snapshot_row.unresolved_count
            <> totals.unresolved_count

        OR

        snapshot_row.captured_variance_amount
            <> totals.captured_variance_amount

        OR

        snapshot_row.executed_financial_amount
            <> totals.executed_financial_amount

        OR

        snapshot_row.recovered_amount
            <> totals.recovered_amount

        OR

        snapshot_row.written_off_amount
            <> totals.written_off_amount

        OR

        snapshot_row.completed_investigation_amount
            <> totals.completed_investigation_amount

        OR

        snapshot_row.open_exposure_amount
            <> totals.open_exposure_amount
    THEN
        RAISE EXCEPTION
            'Treatment-execution snapshot header does not match captured item evidence';
    END IF;

    RETURN NULL;
END;
$$;


CREATE CONSTRAINT TRIGGER trg_fve74_validate_snapshot
AFTER INSERT OR UPDATE
ON procurement_variance_execution_snapshots
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION procureiq_fve74_validate_snapshot();


CREATE TRIGGER trg_audit_variance_execution_cases
AFTER INSERT OR UPDATE
ON procurement_variance_execution_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_variance_execution_items
AFTER INSERT
ON procurement_variance_execution_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_variance_execution_snapshots
AFTER INSERT
ON procurement_variance_execution_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
