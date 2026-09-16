/*
 * PROCUREIQ — STEP 90
 * RESIDUAL-CYCLE ROLLOVER RUNTIME INTEGRITY
 *
 * Historical V81 remains immutable.
 *
 * V82 revalidates the source outcome at every important runtime boundary
 * and strengthens snapshot and lifecycle integrity.
 */


/*
 * ---------------------------------------------------------------------------
 * SOURCE AUTHORITY REVALIDATION
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fcr90_validate_source_authority(
    requested_rollover_case_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    stored_source_outcome_case_id UUID;
    stored_source_outcome_number VARCHAR(80);

    stored_parent_case_id UUID;
    stored_parent_number VARCHAR(80);

    stored_title VARCHAR(240);
    stored_currency VARCHAR(3);
    stored_year INTEGER;

    stored_residual NUMERIC(20, 2);
    stored_item_count INTEGER;

    source_status VARCHAR(30);
    source_disposition VARCHAR(50);
    source_verified_residual NUMERIC(20, 2);

    source_outcome_number VARCHAR(80);
    source_parent_case_id UUID;
    source_parent_number VARCHAR(80);

    source_title VARCHAR(240);
    source_currency VARCHAR(3);
    source_year INTEGER;

    authoritative_count INTEGER;
    authoritative_residual NUMERIC(20, 2);
BEGIN
    SELECT
        rollover.source_continuation_outcome_case_id,
        rollover.source_continuation_outcome_number,
        rollover.parent_continuation_case_id,
        rollover.parent_continuation_number,
        rollover.title,
        rollover.currency,
        rollover.fiscal_year,
        rollover.source_remaining_residual_amount,
        rollover.source_residual_item_count

    INTO
        stored_source_outcome_case_id,
        stored_source_outcome_number,
        stored_parent_case_id,
        stored_parent_number,
        stored_title,
        stored_currency,
        stored_year,
        stored_residual,
        stored_item_count

    FROM procurement_remediation_continuation_rollover_cases rollover

    WHERE rollover.id =
        requested_rollover_case_id

    FOR SHARE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Continuation rollover case does not exist';
    END IF;


    SELECT
        outcome.status,
        outcome.residual_disposition,
        outcome.verified_remaining_residual_amount,
        outcome.outcome_number,
        outcome.source_continuation_case_id,
        outcome.source_continuation_number,
        outcome.title,
        outcome.currency,
        outcome.fiscal_year

    INTO
        source_status,
        source_disposition,
        source_verified_residual,
        source_outcome_number,
        source_parent_case_id,
        source_parent_number,
        source_title,
        source_currency,
        source_year

    FROM procurement_remediation_continuation_outcome_cases outcome

    WHERE outcome.id =
        stored_source_outcome_case_id

    FOR SHARE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source continuation outcome no longer exists';
    END IF;


    IF
        source_status <> 'VERIFIED'

        OR

        source_disposition <> 'FURTHER_GOVERNANCE_REQUIRED'

        OR

        source_verified_residual IS NULL

        OR

        source_verified_residual <= 0
    THEN
        RAISE EXCEPTION
            'Continuation rollover source is no longer VERIFIED positive residual requiring further governance';
    END IF;


    SELECT
        COUNT(*),
        COALESCE(
            SUM(
                item.remaining_residual_amount
            ),
            0
        )

    INTO
        authoritative_count,
        authoritative_residual

    FROM procurement_remediation_continuation_outcome_items item

    WHERE item.outcome_case_id =
        stored_source_outcome_case_id

    AND item.remaining_residual_amount > 0;


    IF
        authoritative_count <= 0

        OR

        authoritative_residual
            IS DISTINCT FROM source_verified_residual
    THEN
        RAISE EXCEPTION
            'Continuation rollover source positive residual no longer reconciles';
    END IF;


    IF
        stored_source_outcome_number
            IS DISTINCT FROM source_outcome_number

        OR

        stored_parent_case_id
            IS DISTINCT FROM source_parent_case_id

        OR

        stored_parent_number
            IS DISTINCT FROM source_parent_number

        OR

        stored_title
            IS DISTINCT FROM source_title

        OR

        stored_currency
            IS DISTINCT FROM source_currency

        OR

        stored_year
            IS DISTINCT FROM source_year

        OR

        stored_residual
            IS DISTINCT FROM source_verified_residual

        OR

        stored_item_count
            IS DISTINCT FROM authoritative_count
    THEN
        RAISE EXCEPTION
            'Continuation rollover stored lineage no longer matches source authority';
    END IF;
END;
$$;


/*
 * ---------------------------------------------------------------------------
 * ITEM INSERT — REVALIDATE SOURCE CASE
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fcr89_validate_item_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    rollover_status VARCHAR(30);
    source_outcome_case_id UUID;

    authoritative_outcome_case_id UUID;
    authoritative_continuation_item_id UUID;
    authoritative_action VARCHAR(50);
    authoritative_resolution VARCHAR(50);
    authoritative_remaining NUMERIC(20, 2);
BEGIN
    SELECT
        status,
        source_continuation_outcome_case_id

    INTO
        rollover_status,
        source_outcome_case_id

    FROM procurement_remediation_continuation_rollover_cases

    WHERE id =
        NEW.rollover_case_id

    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Continuation rollover case does not exist';
    END IF;


    IF rollover_status <> 'DRAFT' THEN
        RAISE EXCEPTION
            'Continuation rollover items can be added only while DRAFT';
    END IF;


    PERFORM
        procureiq_fcr90_validate_source_authority(
            NEW.rollover_case_id
        );


    SELECT
        item.outcome_case_id,
        item.source_continuation_item_id,
        item.source_continuation_action,
        item.resolution_type,
        item.remaining_residual_amount

    INTO
        authoritative_outcome_case_id,
        authoritative_continuation_item_id,
        authoritative_action,
        authoritative_resolution,
        authoritative_remaining

    FROM procurement_remediation_continuation_outcome_items item

    WHERE item.id =
        NEW.source_continuation_outcome_item_id

    FOR SHARE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source continuation outcome item does not exist';
    END IF;


    IF authoritative_outcome_case_id <> source_outcome_case_id THEN
        RAISE EXCEPTION
            'Source continuation outcome item belongs to another source outcome';
    END IF;


    IF authoritative_remaining <= 0 THEN
        RAISE EXCEPTION
            'Only positive continuation outcome residual may roll forward';
    END IF;


    IF
        NEW.source_continuation_item_id
            IS DISTINCT FROM authoritative_continuation_item_id

        OR

        NEW.source_continuation_action
            IS DISTINCT FROM authoritative_action

        OR

        NEW.source_resolution_type
            IS DISTINCT FROM authoritative_resolution

        OR

        NEW.source_remaining_residual_amount
            IS DISTINCT FROM authoritative_remaining
    THEN
        RAISE EXCEPTION
            'Continuation rollover item does not match source authority';
    END IF;


    IF
        NEW.continuation_action
            IS DISTINCT FROM authoritative_action
    THEN
        RAISE EXCEPTION
            'Continuation rollover action must preserve prior continuation action';
    END IF;


    IF NEW.target_date < CURRENT_DATE THEN
        RAISE EXCEPTION
            'Continuation rollover target date cannot be in the past';
    END IF;


    IF
        BTRIM(
            COALESCE(
                NEW.rationale,
                ''
            )
        ) = ''
    THEN
        RAISE EXCEPTION
            'Continuation rollover rationale is required';
    END IF;


    RETURN NEW;
END;
$$;


/*
 * ---------------------------------------------------------------------------
 * STRICT LIFECYCLE
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fcr89_protect_case_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF
        NEW.id
            IS DISTINCT FROM OLD.id

        OR

        NEW.rollover_number
            IS DISTINCT FROM OLD.rollover_number

        OR

        NEW.source_continuation_outcome_case_id
            IS DISTINCT FROM OLD.source_continuation_outcome_case_id

        OR

        NEW.source_continuation_outcome_number
            IS DISTINCT FROM OLD.source_continuation_outcome_number

        OR

        NEW.parent_continuation_case_id
            IS DISTINCT FROM OLD.parent_continuation_case_id

        OR

        NEW.parent_continuation_number
            IS DISTINCT FROM OLD.parent_continuation_number

        OR

        NEW.title
            IS DISTINCT FROM OLD.title

        OR

        NEW.currency
            IS DISTINCT FROM OLD.currency

        OR

        NEW.fiscal_year
            IS DISTINCT FROM OLD.fiscal_year

        OR

        NEW.source_remaining_residual_amount
            IS DISTINCT FROM OLD.source_remaining_residual_amount

        OR

        NEW.source_residual_item_count
            IS DISTINCT FROM OLD.source_residual_item_count

        OR

        NEW.owner_user_id
            IS DISTINCT FROM OLD.owner_user_id

        OR

        NEW.owner_name
            IS DISTINCT FROM OLD.owner_name

        OR

        NEW.created_by_user_id
            IS DISTINCT FROM OLD.created_by_user_id

        OR

        NEW.created_at
            IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION
            'Continuation rollover source authority is immutable';
    END IF;


    IF NEW.version <> OLD.version + 1 THEN
        RAISE EXCEPTION
            'Continuation rollover version must increment exactly once';
    END IF;


    /*
     * DRAFT -> IN_REVIEW
     */
    IF
        OLD.status = 'DRAFT'

        AND

        NEW.status = 'IN_REVIEW'
    THEN
        PERFORM
            procureiq_fcr90_validate_source_authority(
                OLD.id
            );

        PERFORM
            procureiq_fcr89_validate_complete(
                OLD.id
            );


        IF
            OLD.review_submitted_by_user_id IS NOT NULL

            OR

            OLD.review_submitted_at IS NOT NULL

            OR

            OLD.approved_by_user_id IS NOT NULL

            OR

            OLD.approved_at IS NOT NULL

            OR

            OLD.approval_note IS NOT NULL

            OR

            OLD.closed_by_user_id IS NOT NULL

            OR

            OLD.closed_at IS NOT NULL

            OR

            OLD.close_note IS NOT NULL
        THEN
            RAISE EXCEPTION
                'DRAFT continuation rollover contains unexpected lifecycle evidence';
        END IF;


        IF
            NEW.review_submitted_by_user_id IS NULL

            OR

            NEW.review_submitted_at IS NULL
        THEN
            RAISE EXCEPTION
                'Continuation rollover submission evidence is required';
        END IF;


        IF
            NEW.approved_by_user_id IS NOT NULL

            OR

            NEW.approved_at IS NOT NULL

            OR

            NEW.approval_note IS NOT NULL

            OR

            NEW.closed_by_user_id IS NOT NULL

            OR

            NEW.closed_at IS NOT NULL

            OR

            NEW.close_note IS NOT NULL
        THEN
            RAISE EXCEPTION
                'Submission cannot pre-populate approval or closure evidence';
        END IF;


        RETURN NEW;
    END IF;


    /*
     * IN_REVIEW -> APPROVED
     */
    IF
        OLD.status = 'IN_REVIEW'

        AND

        NEW.status = 'APPROVED'
    THEN
        PERFORM
            procureiq_fcr90_validate_source_authority(
                OLD.id
            );

        PERFORM
            procureiq_fcr89_validate_complete(
                OLD.id
            );


        IF
            OLD.review_submitted_by_user_id IS NULL

            OR

            OLD.review_submitted_at IS NULL
        THEN
            RAISE EXCEPTION
                'IN_REVIEW continuation rollover is missing submission evidence';
        END IF;


        IF
            OLD.approved_by_user_id IS NOT NULL

            OR

            OLD.approved_at IS NOT NULL

            OR

            OLD.approval_note IS NOT NULL

            OR

            OLD.closed_by_user_id IS NOT NULL

            OR

            OLD.closed_at IS NOT NULL

            OR

            OLD.close_note IS NOT NULL
        THEN
            RAISE EXCEPTION
                'IN_REVIEW continuation rollover contains unexpected later lifecycle evidence';
        END IF;


        IF
            NEW.review_submitted_by_user_id
                IS DISTINCT FROM OLD.review_submitted_by_user_id

            OR

            NEW.review_submitted_at
                IS DISTINCT FROM OLD.review_submitted_at
        THEN
            RAISE EXCEPTION
                'Approval cannot alter submission evidence';
        END IF;


        IF
            NEW.approved_by_user_id IS NULL

            OR

            NEW.approved_at IS NULL

            OR

            BTRIM(
                COALESCE(
                    NEW.approval_note,
                    ''
                )
            ) = ''
        THEN
            RAISE EXCEPTION
                'Manager approval evidence is required';
        END IF;


        IF
            NEW.closed_by_user_id IS NOT NULL

            OR

            NEW.closed_at IS NOT NULL

            OR

            NEW.close_note IS NOT NULL
        THEN
            RAISE EXCEPTION
                'Approval cannot pre-populate closure evidence';
        END IF;


        RETURN NEW;
    END IF;


    /*
     * APPROVED -> CLOSED
     */
    IF
        OLD.status = 'APPROVED'

        AND

        NEW.status = 'CLOSED'
    THEN
        PERFORM
            procureiq_fcr90_validate_source_authority(
                OLD.id
            );

        PERFORM
            procureiq_fcr89_validate_complete(
                OLD.id
            );


        IF
            OLD.review_submitted_by_user_id IS NULL

            OR

            OLD.review_submitted_at IS NULL

            OR

            OLD.approved_by_user_id IS NULL

            OR

            OLD.approved_at IS NULL

            OR

            BTRIM(
                COALESCE(
                    OLD.approval_note,
                    ''
                )
            ) = ''
        THEN
            RAISE EXCEPTION
                'APPROVED continuation rollover is missing prior governance evidence';
        END IF;


        IF
            OLD.closed_by_user_id IS NOT NULL

            OR

            OLD.closed_at IS NOT NULL

            OR

            OLD.close_note IS NOT NULL
        THEN
            RAISE EXCEPTION
                'APPROVED continuation rollover contains unexpected closure evidence';
        END IF;


        IF
            NEW.review_submitted_by_user_id
                IS DISTINCT FROM OLD.review_submitted_by_user_id

            OR

            NEW.review_submitted_at
                IS DISTINCT FROM OLD.review_submitted_at

            OR

            NEW.approved_by_user_id
                IS DISTINCT FROM OLD.approved_by_user_id

            OR

            NEW.approved_at
                IS DISTINCT FROM OLD.approved_at

            OR

            NEW.approval_note
                IS DISTINCT FROM OLD.approval_note
        THEN
            RAISE EXCEPTION
                'Closure cannot alter prior rollover evidence';
        END IF;


        IF
            NEW.closed_by_user_id IS NULL

            OR

            NEW.closed_at IS NULL

            OR

            BTRIM(
                COALESCE(
                    NEW.close_note,
                    ''
                )
            ) = ''
        THEN
            RAISE EXCEPTION
                'Continuation rollover closure evidence is required';
        END IF;


        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Invalid continuation rollover lifecycle transition: % -> %',
        OLD.status,
        NEW.status;
END;
$$;


/*
 * ---------------------------------------------------------------------------
 * SNAPSHOT INSERT REVALIDATION
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fcr89_snapshot_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    authoritative_rollover_number VARCHAR(80);
    authoritative_source_outcome_case_id UUID;
    authoritative_source_outcome_number VARCHAR(80);
    authoritative_parent_case_id UUID;
    authoritative_parent_number VARCHAR(80);
    authoritative_title VARCHAR(240);
    authoritative_currency VARCHAR(3);
    authoritative_year INTEGER;
    authoritative_amount NUMERIC(20, 2);
    authoritative_count INTEGER;
    authoritative_status VARCHAR(30);
BEGIN
    PERFORM
        procureiq_fcr90_validate_source_authority(
            NEW.rollover_case_id
        );

    PERFORM
        procureiq_fcr89_validate_complete(
            NEW.rollover_case_id
        );


    SELECT
        rollover.rollover_number,
        rollover.source_continuation_outcome_case_id,
        rollover.source_continuation_outcome_number,
        rollover.parent_continuation_case_id,
        rollover.parent_continuation_number,
        rollover.title,
        rollover.currency,
        rollover.fiscal_year,
        rollover.source_remaining_residual_amount,
        rollover.source_residual_item_count,
        rollover.status

    INTO
        authoritative_rollover_number,
        authoritative_source_outcome_case_id,
        authoritative_source_outcome_number,
        authoritative_parent_case_id,
        authoritative_parent_number,
        authoritative_title,
        authoritative_currency,
        authoritative_year,
        authoritative_amount,
        authoritative_count,
        authoritative_status

    FROM procurement_remediation_continuation_rollover_cases rollover

    WHERE rollover.id =
        NEW.rollover_case_id

    FOR SHARE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Continuation rollover case does not exist for snapshot';
    END IF;


    IF NEW.sealed THEN
        RAISE EXCEPTION
            'Continuation rollover snapshot must be created unsealed';
    END IF;


    IF
        NEW.rollover_number
            IS DISTINCT FROM authoritative_rollover_number

        OR

        NEW.source_continuation_outcome_case_id
            IS DISTINCT FROM authoritative_source_outcome_case_id

        OR

        NEW.source_continuation_outcome_number
            IS DISTINCT FROM authoritative_source_outcome_number

        OR

        NEW.parent_continuation_case_id
            IS DISTINCT FROM authoritative_parent_case_id

        OR

        NEW.parent_continuation_number
            IS DISTINCT FROM authoritative_parent_number

        OR

        NEW.title
            IS DISTINCT FROM authoritative_title

        OR

        NEW.currency
            IS DISTINCT FROM authoritative_currency

        OR

        NEW.fiscal_year
            IS DISTINCT FROM authoritative_year

        OR

        NEW.source_remaining_residual_amount
            IS DISTINCT FROM authoritative_amount

        OR

        NEW.item_count
            IS DISTINCT FROM authoritative_count

        OR

        NEW.rollover_status
            IS DISTINCT FROM authoritative_status
    THEN
        RAISE EXCEPTION
            'Continuation rollover snapshot header does not match authority';
    END IF;


    RETURN NEW;
END;
$$;


/*
 * ---------------------------------------------------------------------------
 * SNAPSHOT SEALING — AUTHORITATIVE COVERAGE
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fcr89_snapshot_header_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    snapshot_count INTEGER;
    snapshot_amount NUMERIC(20, 2);

    authoritative_count INTEGER;
    authoritative_amount NUMERIC(20, 2);

    authoritative_status VARCHAR(30);
BEGIN
    IF
        TG_OP = 'UPDATE'

        AND

        OLD.sealed = FALSE

        AND

        NEW.sealed = TRUE
    THEN
        IF
            NEW.id
                IS DISTINCT FROM OLD.id

            OR

            NEW.snapshot_number
                IS DISTINCT FROM OLD.snapshot_number

            OR

            NEW.rollover_case_id
                IS DISTINCT FROM OLD.rollover_case_id

            OR

            NEW.rollover_number
                IS DISTINCT FROM OLD.rollover_number

            OR

            NEW.source_continuation_outcome_case_id
                IS DISTINCT FROM OLD.source_continuation_outcome_case_id

            OR

            NEW.source_continuation_outcome_number
                IS DISTINCT FROM OLD.source_continuation_outcome_number

            OR

            NEW.parent_continuation_case_id
                IS DISTINCT FROM OLD.parent_continuation_case_id

            OR

            NEW.parent_continuation_number
                IS DISTINCT FROM OLD.parent_continuation_number

            OR

            NEW.title
                IS DISTINCT FROM OLD.title

            OR

            NEW.currency
                IS DISTINCT FROM OLD.currency

            OR

            NEW.fiscal_year
                IS DISTINCT FROM OLD.fiscal_year

            OR

            NEW.source_remaining_residual_amount
                IS DISTINCT FROM OLD.source_remaining_residual_amount

            OR

            NEW.item_count
                IS DISTINCT FROM OLD.item_count

            OR

            NEW.rollover_status
                IS DISTINCT FROM OLD.rollover_status

            OR

            NEW.captured_by_user_id
                IS DISTINCT FROM OLD.captured_by_user_id

            OR

            NEW.captured_at
                IS DISTINCT FROM OLD.captured_at
        THEN
            RAISE EXCEPTION
                'Continuation rollover snapshot content cannot change while sealing';
        END IF;


        PERFORM
            procureiq_fcr90_validate_source_authority(
                OLD.rollover_case_id
            );

        PERFORM
            procureiq_fcr89_validate_complete(
                OLD.rollover_case_id
            );


        SELECT
            status

        INTO
            authoritative_status

        FROM procurement_remediation_continuation_rollover_cases

        WHERE id =
            OLD.rollover_case_id

        FOR SHARE;


        IF authoritative_status
            IS DISTINCT FROM OLD.rollover_status
        THEN
            RAISE EXCEPTION
                'Continuation rollover snapshot status no longer matches rollover authority';
        END IF;


        SELECT
            COUNT(*),
            COALESCE(
                SUM(
                    source_remaining_residual_amount
                ),
                0
            )

        INTO
            authoritative_count,
            authoritative_amount

        FROM procurement_remediation_continuation_rollover_items

        WHERE rollover_case_id =
            OLD.rollover_case_id;


        SELECT
            COUNT(*),
            COALESCE(
                SUM(
                    source_remaining_residual_amount
                ),
                0
            )

        INTO
            snapshot_count,
            snapshot_amount

        FROM procurement_remediation_continuation_rollover_snapshot_items

        WHERE snapshot_id =
            OLD.id;


        IF
            authoritative_count <> OLD.item_count

            OR

            authoritative_amount
                <> OLD.source_remaining_residual_amount

            OR

            snapshot_count <> authoritative_count

            OR

            snapshot_count <> OLD.item_count

            OR

            snapshot_amount <> authoritative_amount

            OR

            snapshot_amount
                <> OLD.source_remaining_residual_amount
        THEN
            RAISE EXCEPTION
                'Continuation rollover snapshot does not reconcile to authoritative rollover evidence';
        END IF;


        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Continuation rollover snapshots are immutable after creation';
END;
$$;
