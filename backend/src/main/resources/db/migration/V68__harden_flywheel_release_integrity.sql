ALTER TABLE procurement_flywheel_release_batches
    DROP CONSTRAINT ck_flywheel_release_status;

ALTER TABLE procurement_flywheel_release_batches
    ADD CONSTRAINT ck_flywheel_release_status CHECK (
        status IN (
            'DRAFT',
            'IN_EXECUTION',
            'EXECUTED',
            'CLOSED',
            'CANCELLED'
        )
    ),
    ADD CONSTRAINT ck_fwr70_cancel_evidence CHECK (
        status <> 'CANCELLED'
        OR (
            closed_by_user_id IS NOT NULL
            AND closed_at IS NOT NULL
            AND close_note IS NOT NULL
            AND length(btrim(close_note)) > 0
        )
    );

DROP INDEX uk_flywheel_release_open_mandate;

CREATE UNIQUE INDEX uk_flywheel_release_open_mandate
    ON procurement_flywheel_release_batches (
        allocation_mandate_id
    )
    WHERE status NOT IN ('CLOSED', 'CANCELLED');

ALTER TABLE procurement_flywheel_release_snapshots
    ADD COLUMN sealed BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE procurement_flywheel_release_snapshots
    ADD CONSTRAINT ck_fwr70_snapshot_capacity CHECK (
        remaining_mandate_amount >= 0
        AND cumulative_mandate_released_amount
            <= mandate_authorized_amount
        AND remaining_mandate_amount
            = mandate_authorized_amount
              - cumulative_mandate_released_amount
    );

CREATE FUNCTION procureiq_fwr70_protect_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    batch_status TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Release history cannot be deleted';
    END IF;

    IF OLD.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Final release item evidence cannot be changed';
    END IF;

    IF (
        to_jsonb(NEW) - ARRAY[
            'status',
            'execution_reference',
            'execution_note',
            'released_by_user_id',
            'released_at',
            'cancellation_note',
            'cancelled_by_user_id',
            'cancelled_at'
        ]
    ) IS DISTINCT FROM (
        to_jsonb(OLD) - ARRAY[
            'status',
            'execution_reference',
            'execution_note',
            'released_by_user_id',
            'released_at',
            'cancellation_note',
            'cancelled_by_user_id',
            'cancelled_at'
        ]
    ) THEN
        RAISE EXCEPTION 'Captured release item authority cannot be changed';
    END IF;

    SELECT status
    INTO batch_status
    FROM procurement_flywheel_release_batches
    WHERE id = NEW.release_batch_id;

    IF NEW.status = 'RELEASED' THEN
        IF batch_status IS DISTINCT FROM 'IN_EXECUTION'
            OR NEW.execution_reference IS NULL
            OR length(btrim(NEW.execution_reference)) = 0
            OR NEW.execution_note IS NULL
            OR length(btrim(NEW.execution_note)) = 0
        THEN
            RAISE EXCEPTION
                'Release requires an executing batch and nonblank evidence';
        END IF;

    ELSIF NEW.status = 'CANCELLED' THEN
        IF batch_status NOT IN ('DRAFT', 'IN_EXECUTION')
            OR NEW.cancellation_note IS NULL
            OR length(btrim(NEW.cancellation_note)) = 0
        THEN
            RAISE EXCEPTION
                'Cancellation requires an open batch and a nonblank rationale';
        END IF;

    ELSE
        RAISE EXCEPTION
            'Only final transitions from PENDING are supported';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fwr70_protect_item
BEFORE UPDATE OR DELETE
ON procurement_flywheel_release_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_fwr70_protect_item();

CREATE FUNCTION procureiq_fwr70_protect_batch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Release batch history cannot be deleted';
    END IF;

    IF NOT (
        (
            OLD.status = 'DRAFT'
            AND NEW.status IN ('IN_EXECUTION', 'CANCELLED')
        )
        OR (
            OLD.status = 'IN_EXECUTION'
            AND NEW.status IN ('EXECUTED', 'CANCELLED')
        )
        OR (
            OLD.status = 'EXECUTED'
            AND NEW.status = 'CLOSED'
        )
    ) THEN
        RAISE EXCEPTION
            'Invalid release batch transition: % to %',
            OLD.status,
            NEW.status;
    END IF;

    IF NEW.status = 'CANCELLED'
        AND EXISTS (
            SELECT 1
            FROM procurement_flywheel_release_items
            WHERE release_batch_id = NEW.id
              AND status <> 'CANCELLED'
        )
    THEN
        RAISE EXCEPTION
            'Batch cancellation requires all items to be cancelled';
    END IF;

    IF NEW.status = 'EXECUTED'
        AND (
            EXISTS (
                SELECT 1
                FROM procurement_flywheel_release_items
                WHERE release_batch_id = NEW.id
                  AND status = 'PENDING'
            )
            OR NOT EXISTS (
                SELECT 1
                FROM procurement_flywheel_release_items
                WHERE release_batch_id = NEW.id
                  AND status = 'RELEASED'
            )
        )
    THEN
        RAISE EXCEPTION
            'Executed batch requires a recorded release and no pending items';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fwr70_protect_batch
BEFORE UPDATE OR DELETE
ON procurement_flywheel_release_batches
FOR EACH ROW
EXECUTE FUNCTION procureiq_fwr70_protect_batch();

-- Existing snapshots start sealed.
-- New application snapshots permit exactly one FALSE -> TRUE seal transition.
CREATE OR REPLACE FUNCTION procureiq_prevent_flywheel_release_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_TABLE_NAME = 'procurement_flywheel_release_snapshots'
        AND TG_OP = 'UPDATE'
    THEN
        IF (to_jsonb(OLD)->>'sealed')::boolean = FALSE
            AND (to_jsonb(NEW)->>'sealed')::boolean = TRUE
            AND (to_jsonb(OLD) - 'sealed')
                = (to_jsonb(NEW) - 'sealed')
        THEN
            RETURN NEW;
        END IF;
    END IF;

    RAISE EXCEPTION
        'Procurement flywheel release snapshot evidence is immutable';
END;
$$;

CREATE FUNCTION procureiq_fwr70_check_snapshot_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_sealed BOOLEAN;
BEGIN
    SELECT sealed
    INTO parent_sealed
    FROM procurement_flywheel_release_snapshots
    WHERE id = NEW.snapshot_id
    FOR UPDATE;

    IF parent_sealed IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION
            'Cannot append items to a sealed release snapshot';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fwr70_snapshot_insert
BEFORE INSERT
ON procurement_flywheel_release_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_fwr70_check_snapshot_insert();

CREATE FUNCTION procureiq_fwr70_validate_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    header RECORD;
    counts RECORD;
BEGIN
    SELECT *
    INTO header
    FROM procurement_flywheel_release_snapshots
    WHERE id = NEW.id;

    IF NOT FOUND OR NOT header.sealed THEN
        RAISE EXCEPTION
            'A release snapshot must be sealed before commit';
    END IF;

    SELECT
        count(*) AS total,

        count(*) FILTER (
            WHERE release_item_status = 'PENDING'
        ) AS pending,

        count(*) FILTER (
            WHERE release_item_status = 'RELEASED'
        ) AS released,

        count(*) FILTER (
            WHERE release_item_status = 'CANCELLED'
        ) AS cancelled,

        coalesce(
            sum(planned_release_amount) FILTER (
                WHERE release_item_status <> 'CANCELLED'
            ),
            0
        ) AS planned,

        coalesce(
            sum(planned_release_amount) FILTER (
                WHERE release_item_status = 'RELEASED'
            ),
            0
        ) AS amount

    INTO counts
    FROM procurement_flywheel_release_snapshot_items
    WHERE snapshot_id = NEW.id;

    IF header.item_count <> counts.total
        OR header.pending_count <> counts.pending
        OR header.released_count <> counts.released
        OR header.cancelled_count <> counts.cancelled
        OR header.batch_planned_release_amount <> counts.planned
        OR header.batch_released_amount <> counts.amount
    THEN
        RAISE EXCEPTION
            'Release snapshot header does not match its captured items';
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_fwr70_validate_snapshot
AFTER INSERT OR UPDATE
ON procurement_flywheel_release_snapshots
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION procureiq_fwr70_validate_snapshot();
