CREATE UNIQUE INDEX uk_fs72_release_item_global
    ON procurement_flywheel_settlement_items (
        release_item_id
    );


CREATE FUNCTION procureiq_fs72_validate_case_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    source_batch RECORD;

    released_count BIGINT;
    released_amount NUMERIC(20, 2);
BEGIN
    SELECT
        release_number,
        allocation_mandate_id,
        allocation_mandate_number,
        strategy_portfolio_id,
        strategy_portfolio_number,
        currency,
        fiscal_year,
        status

    INTO source_batch

    FROM procurement_flywheel_release_batches

    WHERE id = NEW.release_batch_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source release batch does not exist';
    END IF;

    IF source_batch.status NOT IN (
        'EXECUTED',
        'CLOSED'
    ) THEN
        RAISE EXCEPTION
            'Settlement cases require an EXECUTED or CLOSED release batch';
    END IF;

    SELECT
        count(*),
        coalesce(
            sum(planned_release_amount),
            0
        )

    INTO
        released_count,
        released_amount

    FROM procurement_flywheel_release_items

    WHERE release_batch_id = NEW.release_batch_id
    AND status = 'RELEASED';

    IF released_count = 0 THEN
        RAISE EXCEPTION
            'Source release batch contains no RELEASED items';
    END IF;

    IF
        NEW.release_number
            IS DISTINCT FROM
            source_batch.release_number

        OR

        NEW.allocation_mandate_id
            IS DISTINCT FROM
            source_batch.allocation_mandate_id

        OR

        NEW.allocation_mandate_number
            IS DISTINCT FROM
            source_batch.allocation_mandate_number

        OR

        NEW.strategy_portfolio_id
            IS DISTINCT FROM
            source_batch.strategy_portfolio_id

        OR

        NEW.strategy_portfolio_number
            IS DISTINCT FROM
            source_batch.strategy_portfolio_number

        OR

        NEW.currency
            IS DISTINCT FROM
            source_batch.currency

        OR

        NEW.fiscal_year
            IS DISTINCT FROM
            source_batch.fiscal_year

        OR

        NEW.source_released_amount
            IS DISTINCT FROM
            released_amount
    THEN
        RAISE EXCEPTION
            'Settlement case does not match finalized release authority';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_fs72_validate_case_insert
BEFORE INSERT
ON procurement_flywheel_settlement_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_fs72_validate_case_insert();


CREATE FUNCTION procureiq_fs72_validate_item_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    settlement_case RECORD;
    source_item RECORD;
BEGIN
    SELECT
        release_batch_id,
        status

    INTO settlement_case

    FROM procurement_flywheel_settlement_cases

    WHERE id = NEW.settlement_case_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Settlement case does not exist';
    END IF;

    IF settlement_case.status <> 'DRAFT' THEN
        RAISE EXCEPTION
            'Settlement evidence can be inserted only while the case is DRAFT';
    END IF;

    SELECT
        release_batch_id,
        allocation_item_id,
        flywheel_lineage_id,
        lineage_number,
        root_target_initiative_title,
        planned_release_amount,
        status

    INTO source_item

    FROM procurement_flywheel_release_items

    WHERE id = NEW.release_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source release item does not exist';
    END IF;

    IF source_item.status <> 'RELEASED' THEN
        RAISE EXCEPTION
            'Settlement evidence requires a RELEASED source item';
    END IF;

    IF
        source_item.release_batch_id
            IS DISTINCT FROM
            settlement_case.release_batch_id

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
            source_item.planned_release_amount
    THEN
        RAISE EXCEPTION
            'Settlement evidence does not match the source release item';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_fs72_validate_item_insert
BEFORE INSERT
ON procurement_flywheel_settlement_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_fs72_validate_item_insert();


CREATE OR REPLACE FUNCTION procureiq_fs71_protect_case()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    source_status TEXT;

    source_item_count BIGINT;
    evidence_item_count BIGINT;

    source_amount NUMERIC(20, 2);
    evidence_source_amount NUMERIC(20, 2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Settlement reconciliation history cannot be deleted';
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
                'Settlement case authority cannot change during review submission';
        END IF;

        IF
            NEW.submitted_by_user_id IS NULL
            OR
            NEW.submitted_at IS NULL
            OR
            NEW.version <> OLD.version + 1
        THEN
            RAISE EXCEPTION
                'Review submission evidence is incomplete';
        END IF;

        SELECT status
        INTO source_status
        FROM procurement_flywheel_release_batches
        WHERE id = NEW.release_batch_id;

        IF source_status NOT IN (
            'EXECUTED',
            'CLOSED'
        ) THEN
            RAISE EXCEPTION
                'Source release is no longer finalized';
        END IF;

        SELECT
            count(*),
            coalesce(
                sum(planned_release_amount),
                0
            )

        INTO
            source_item_count,
            source_amount

        FROM procurement_flywheel_release_items

        WHERE release_batch_id = NEW.release_batch_id
        AND status = 'RELEASED';

        SELECT
            count(*),
            coalesce(
                sum(source_released_amount),
                0
            )

        INTO
            evidence_item_count,
            evidence_source_amount

        FROM procurement_flywheel_settlement_items

        WHERE settlement_case_id = NEW.id;

        IF
            source_item_count = 0

            OR

            evidence_item_count
                <> source_item_count

            OR

            evidence_source_amount
                <> source_amount

            OR

            NEW.source_released_amount
                <> source_amount
        THEN
            RAISE EXCEPTION
                'Every finalized RELEASED source item requires matching settlement evidence';
        END IF;

        RETURN NEW;
    END IF;


    IF (
        OLD.status = 'IN_REVIEW'
        AND
        NEW.status = 'RECONCILED'
    ) THEN
        IF (
            to_jsonb(NEW)
                - ARRAY[
                    'status',
                    'reconciliation_note',
                    'reconciled_by_user_id',
                    'reconciled_at',
                    'updated_at',
                    'version'
                ]
        ) IS DISTINCT FROM (
            to_jsonb(OLD)
                - ARRAY[
                    'status',
                    'reconciliation_note',
                    'reconciled_by_user_id',
                    'reconciled_at',
                    'updated_at',
                    'version'
                ]
        ) THEN
            RAISE EXCEPTION
                'Settlement case authority cannot change during reconciliation';
        END IF;

        IF
            NEW.reconciled_by_user_id IS NULL
            OR
            NEW.reconciled_at IS NULL
            OR
            NEW.reconciliation_note IS NULL
            OR
            length(
                btrim(
                    NEW.reconciliation_note
                )
            ) = 0
            OR
            NEW.version <> OLD.version + 1
        THEN
            RAISE EXCEPTION
                'Reconciliation evidence is incomplete';
        END IF;

        SELECT status
        INTO source_status
        FROM procurement_flywheel_release_batches
        WHERE id = NEW.release_batch_id;

        IF source_status NOT IN (
            'EXECUTED',
            'CLOSED'
        ) THEN
            RAISE EXCEPTION
                'Source release is no longer finalized';
        END IF;

        SELECT
            count(*),
            coalesce(
                sum(planned_release_amount),
                0
            )

        INTO
            source_item_count,
            source_amount

        FROM procurement_flywheel_release_items

        WHERE release_batch_id = NEW.release_batch_id
        AND status = 'RELEASED';

        SELECT
            count(*),
            coalesce(
                sum(source_released_amount),
                0
            )

        INTO
            evidence_item_count,
            evidence_source_amount

        FROM procurement_flywheel_settlement_items

        WHERE settlement_case_id = NEW.id;

        IF
            source_item_count = 0

            OR

            evidence_item_count
                <> source_item_count

            OR

            evidence_source_amount
                <> source_amount

            OR

            NEW.source_released_amount
                <> source_amount
        THEN
            RAISE EXCEPTION
                'Reconciliation no longer matches finalized release authority';
        END IF;

        RETURN NEW;
    END IF;


    IF (
        OLD.status = 'RECONCILED'
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
                'Settlement case authority cannot change during closure';
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
                'Settlement closure evidence is incomplete';
        END IF;

        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Invalid settlement reconciliation transition: % to %',
        OLD.status,
        NEW.status;
END;
$$;
