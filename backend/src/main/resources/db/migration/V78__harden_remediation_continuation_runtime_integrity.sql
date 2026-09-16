/*
 * STEP 82
 * RESIDUAL CONTINUATION RUNTIME INTEGRITY HARDENING
 *
 * V77 is intentionally preserved.
 *
 * This migration strengthens:
 *   - item-boundary validation
 *   - lifecycle evidence integrity
 *   - full-coverage validation
 *   - snapshot header authority
 *   - snapshot item authority
 *   - snapshot sealing reconciliation
 */


/*
 * ---------------------------------------------------------------------------
 * CONTINUATION ITEM AUTHORITY
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_frc81_validate_item_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    case_status VARCHAR(30);

    authoritative_source_case_id UUID;

    expected_source_case_id UUID;

    authoritative_action VARCHAR(50);

    authoritative_resolution VARCHAR(50);

    authoritative_remaining NUMERIC(20, 2);

    expected_action VARCHAR(50);
BEGIN
    SELECT
        status,
        source_outcome_case_id

    INTO
        case_status,
        expected_source_case_id

    FROM procurement_remediation_continuation_cases

    WHERE id =
        NEW.continuation_case_id

    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Residual continuation case does not exist';
    END IF;


    IF case_status <> 'DRAFT' THEN
        RAISE EXCEPTION
            'Continuation items can be recorded only while DRAFT';
    END IF;


    SELECT
        outcome_case_id,
        source_action,
        resolution_type,
        remaining_residual_amount

    INTO
        authoritative_source_case_id,
        authoritative_action,
        authoritative_resolution,
        authoritative_remaining

    FROM procurement_remediation_outcome_items

    WHERE id =
        NEW.source_outcome_item_id

    FOR SHARE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source remediation outcome item does not exist';
    END IF;


    IF authoritative_source_case_id <> expected_source_case_id THEN
        RAISE EXCEPTION
            'Source outcome item belongs to another outcome case';
    END IF;


    IF authoritative_remaining <= 0 THEN
        RAISE EXCEPTION
            'Continuation requires positive source residual';
    END IF;


    expected_action =
        CASE authoritative_action

            WHEN 'RECOVERY_FOLLOW_UP'
            THEN 'RECOVERY_RETRY'

            WHEN 'WRITE_OFF_REVIEW'
            THEN 'WRITE_OFF_ESCALATION'

            WHEN 'INVESTIGATION_ESCALATION'
            THEN 'INVESTIGATION_ESCALATION'

            WHEN 'RESIDUAL_ACCEPTANCE_REVIEW'
            THEN 'RISK_ACCEPTANCE_ESCALATION'

            ELSE NULL
        END;


    IF expected_action IS NULL THEN
        RAISE EXCEPTION
            'Unsupported source remediation action';
    END IF;


    IF
        NEW.source_action
            IS DISTINCT FROM authoritative_action

        OR

        NEW.source_resolution_type
            IS DISTINCT FROM authoritative_resolution

        OR

        NEW.source_remaining_residual_amount
            IS DISTINCT FROM authoritative_remaining

        OR

        NEW.continuation_action
            IS DISTINCT FROM expected_action
    THEN
        RAISE EXCEPTION
            'Continuation item does not match source remediation authority';
    END IF;


    IF NEW.target_date < CURRENT_DATE THEN
        RAISE EXCEPTION
            'Continuation target date cannot be in the past';
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
            'Continuation rationale is required';
    END IF;


    RETURN NEW;
END;
$$;


/*
 * ---------------------------------------------------------------------------
 * LIFECYCLE AUTHORITY
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_frc81_protect_case_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    /*
     * Source and ownership authority can never be rewritten.
     */
    IF
        NEW.id
            IS DISTINCT FROM OLD.id

        OR

        NEW.continuation_number
            IS DISTINCT FROM OLD.continuation_number

        OR

        NEW.source_outcome_case_id
            IS DISTINCT FROM OLD.source_outcome_case_id

        OR

        NEW.source_outcome_number
            IS DISTINCT FROM OLD.source_outcome_number

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
            'Residual continuation source authority is immutable';
    END IF;


    IF NEW.version <> OLD.version + 1 THEN
        RAISE EXCEPTION
            'Residual continuation version must increment exactly once';
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
            procureiq_frc81_validate_complete(
                OLD.id
            );


        IF
            NEW.review_submitted_by_user_id IS NULL

            OR

            NEW.review_submitted_at IS NULL
        THEN
            RAISE EXCEPTION
                'Continuation review submission evidence is required';
        END IF;


        IF
            NEW.approved_by_user_id
                IS DISTINCT FROM OLD.approved_by_user_id

            OR

            NEW.approved_at
                IS DISTINCT FROM OLD.approved_at

            OR

            NEW.approval_note
                IS DISTINCT FROM OLD.approval_note

            OR

            NEW.closed_by_user_id
                IS DISTINCT FROM OLD.closed_by_user_id

            OR

            NEW.closed_at
                IS DISTINCT FROM OLD.closed_at

            OR

            NEW.close_note
                IS DISTINCT FROM OLD.close_note
        THEN
            RAISE EXCEPTION
                'Submission cannot alter approval or closure evidence';
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
        /*
         * Revalidate complete residual coverage at approval time.
         */
        PERFORM
            procureiq_frc81_validate_complete(
                OLD.id
            );


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


        /*
         * Approval cannot pre-populate closure evidence.
         */
        IF
            NEW.closed_by_user_id
                IS DISTINCT FROM OLD.closed_by_user_id

            OR

            NEW.closed_at
                IS DISTINCT FROM OLD.closed_at

            OR

            NEW.close_note
                IS DISTINCT FROM OLD.close_note
        THEN
            RAISE EXCEPTION
                'Approval cannot alter closure evidence';
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
            procureiq_frc81_validate_complete(
                OLD.id
            );


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
                'Closure cannot alter submission or approval evidence';
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
                'Continuation closure evidence is required';
        END IF;


        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Invalid residual continuation lifecycle transition: % -> %',
        OLD.status,
        NEW.status;
END;
$$;


/*
 * ---------------------------------------------------------------------------
 * SNAPSHOT INSERT AUTHORITY
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_frc81_snapshot_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    authoritative_number VARCHAR(80);

    authoritative_source_case_id UUID;

    authoritative_source_number VARCHAR(80);

    authoritative_title VARCHAR(240);

    authoritative_currency VARCHAR(3);

    authoritative_year INTEGER;

    authoritative_amount NUMERIC(20, 2);

    authoritative_status VARCHAR(30);

    authoritative_count INTEGER;

    actual_count INTEGER;

    actual_amount NUMERIC(20, 2);
BEGIN
    /*
     * Snapshot creation cannot bypass full residual coverage.
     */
    PERFORM
        procureiq_frc81_validate_complete(
            NEW.continuation_case_id
        );


    SELECT
        continuation_number,
        source_outcome_case_id,
        source_outcome_number,
        title,
        currency,
        fiscal_year,
        source_remaining_residual_amount,
        status,
        source_residual_item_count

    INTO
        authoritative_number,
        authoritative_source_case_id,
        authoritative_source_number,
        authoritative_title,
        authoritative_currency,
        authoritative_year,
        authoritative_amount,
        authoritative_status,
        authoritative_count

    FROM procurement_remediation_continuation_cases

    WHERE id =
        NEW.continuation_case_id

    FOR SHARE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Residual continuation case does not exist for snapshot';
    END IF;


    IF NEW.sealed THEN
        RAISE EXCEPTION
            'Residual continuation snapshot must be created unsealed';
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
        actual_count,
        actual_amount

    FROM procurement_remediation_continuation_items

    WHERE continuation_case_id =
        NEW.continuation_case_id;


    IF
        actual_count <> authoritative_count

        OR

        actual_amount <> authoritative_amount
    THEN
        RAISE EXCEPTION
            'Residual continuation snapshot requires complete authoritative coverage';
    END IF;


    IF
        NEW.continuation_number
            IS DISTINCT FROM authoritative_number

        OR

        NEW.source_outcome_case_id
            IS DISTINCT FROM authoritative_source_case_id

        OR

        NEW.source_outcome_number
            IS DISTINCT FROM authoritative_source_number

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

        NEW.continuation_status
            IS DISTINCT FROM authoritative_status
    THEN
        RAISE EXCEPTION
            'Residual continuation snapshot header does not match authoritative case';
    END IF;


    RETURN NEW;
END;
$$;


/*
 * ---------------------------------------------------------------------------
 * SNAPSHOT ITEM AUTHORITY
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_frc81_snapshot_item_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    snapshot_sealed BOOLEAN;

    snapshot_case_id UUID;

    authoritative_case_id UUID;

    authoritative_source_item_id UUID;

    authoritative_source_action VARCHAR(50);

    authoritative_source_resolution VARCHAR(50);

    authoritative_amount NUMERIC(20, 2);

    authoritative_action VARCHAR(50);

    authoritative_target DATE;

    authoritative_rationale VARCHAR(2500);
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT
            sealed,
            continuation_case_id

        INTO
            snapshot_sealed,
            snapshot_case_id

        FROM procurement_remediation_continuation_snapshots

        WHERE id =
            NEW.snapshot_id

        FOR UPDATE;


        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Residual continuation snapshot does not exist';
        END IF;


        IF snapshot_sealed THEN
            RAISE EXCEPTION
                'Cannot append to sealed residual continuation snapshot';
        END IF;


        SELECT
            continuation_case_id,
            source_outcome_item_id,
            source_action,
            source_resolution_type,
            source_remaining_residual_amount,
            continuation_action,
            target_date,
            rationale

        INTO
            authoritative_case_id,
            authoritative_source_item_id,
            authoritative_source_action,
            authoritative_source_resolution,
            authoritative_amount,
            authoritative_action,
            authoritative_target,
            authoritative_rationale

        FROM procurement_remediation_continuation_items

        WHERE id =
            NEW.continuation_item_id

        FOR SHARE;


        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Authoritative continuation item does not exist';
        END IF;


        IF authoritative_case_id <> snapshot_case_id THEN
            RAISE EXCEPTION
                'Continuation snapshot item belongs to another case';
        END IF;


        IF
            NEW.source_outcome_item_id
                IS DISTINCT FROM authoritative_source_item_id

            OR

            NEW.source_action
                IS DISTINCT FROM authoritative_source_action

            OR

            NEW.source_resolution_type
                IS DISTINCT FROM authoritative_source_resolution

            OR

            NEW.source_remaining_residual_amount
                IS DISTINCT FROM authoritative_amount

            OR

            NEW.continuation_action
                IS DISTINCT FROM authoritative_action

            OR

            NEW.target_date
                IS DISTINCT FROM authoritative_target

            OR

            NEW.rationale
                IS DISTINCT FROM authoritative_rationale
        THEN
            RAISE EXCEPTION
                'Continuation snapshot item does not match authoritative governance';
        END IF;


        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Residual continuation snapshot items are immutable';
END;
$$;


/*
 * ---------------------------------------------------------------------------
 * SNAPSHOT SEALING
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_frc81_snapshot_header_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    authoritative_count INTEGER;

    authoritative_amount NUMERIC(20, 2);

    actual_count INTEGER;

    actual_amount NUMERIC(20, 2);
BEGIN
    IF
        TG_OP = 'UPDATE'

        AND

        OLD.sealed = FALSE

        AND

        NEW.sealed = TRUE
    THEN
        /*
         * Sealing is the only allowed header mutation.
         */
        IF
            NEW.id
                IS DISTINCT FROM OLD.id

            OR

            NEW.snapshot_number
                IS DISTINCT FROM OLD.snapshot_number

            OR

            NEW.continuation_case_id
                IS DISTINCT FROM OLD.continuation_case_id

            OR

            NEW.continuation_number
                IS DISTINCT FROM OLD.continuation_number

            OR

            NEW.source_outcome_case_id
                IS DISTINCT FROM OLD.source_outcome_case_id

            OR

            NEW.source_outcome_number
                IS DISTINCT FROM OLD.source_outcome_number

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

            NEW.continuation_status
                IS DISTINCT FROM OLD.continuation_status

            OR

            NEW.captured_by_user_id
                IS DISTINCT FROM OLD.captured_by_user_id

            OR

            NEW.captured_at
                IS DISTINCT FROM OLD.captured_at
        THEN
            RAISE EXCEPTION
                'Continuation snapshot content cannot change while sealing';
        END IF;


        SELECT
            source_residual_item_count,
            source_remaining_residual_amount

        INTO
            authoritative_count,
            authoritative_amount

        FROM procurement_remediation_continuation_cases

        WHERE id =
            OLD.continuation_case_id;


        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Authoritative continuation case does not exist';
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
            actual_count,
            actual_amount

        FROM procurement_remediation_continuation_snapshot_items

        WHERE snapshot_id =
            OLD.id;


        IF
            actual_count <> authoritative_count

            OR

            actual_count <> NEW.item_count

            OR

            actual_amount <> authoritative_amount

            OR

            actual_amount <> NEW.source_remaining_residual_amount
        THEN
            RAISE EXCEPTION
                'Residual continuation snapshot does not reconcile';
        END IF;


        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Residual continuation snapshots are immutable after creation';
END;
$$;
