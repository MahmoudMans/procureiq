/*
 * STEP 79
 * REMEDIATION OUTCOME RUNTIME INTEGRITY HARDENING
 *
 * This migration preserves the V75 data model while strengthening:
 *
 * - lifecycle evidence immutability
 * - snapshot header authority
 * - snapshot item authority
 * - complete snapshot coverage
 * - exact snapshot reconciliation
 */


/*
 * ---------------------------------------------------------------------------
 * CASE LIFECYCLE HARDENING
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fro78_protect_case_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    /*
     * Source authority and ownership are permanently immutable.
     */
    IF
        NEW.id
            IS DISTINCT FROM OLD.id

        OR

        NEW.outcome_number
            IS DISTINCT FROM OLD.outcome_number

        OR

        NEW.source_remediation_plan_id
            IS DISTINCT FROM OLD.source_remediation_plan_id

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

        NEW.source_residual_amount
            IS DISTINCT FROM OLD.source_residual_amount

        OR

        NEW.source_item_count
            IS DISTINCT FROM OLD.source_item_count

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
            'Remediation outcome source authority is immutable';
    END IF;


    IF NEW.version <> OLD.version + 1 THEN
        RAISE EXCEPTION
            'Remediation outcome version must increment exactly once';
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
            procureiq_fro78_validate_complete(
                OLD.id
            );


        IF
            NEW.review_submitted_by_user_id IS NULL

            OR

            NEW.review_submitted_at IS NULL
        THEN
            RAISE EXCEPTION
                'Outcome review submission evidence is required';
        END IF;


        /*
         * Submission may not mutate later-stage evidence.
         */
        IF
            NEW.verified_by_user_id
                IS DISTINCT FROM OLD.verified_by_user_id

            OR

            NEW.verified_at
                IS DISTINCT FROM OLD.verified_at

            OR

            NEW.verification_note
                IS DISTINCT FROM OLD.verification_note

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
                'Review submission cannot alter verification or closure evidence';
        END IF;


        RETURN NEW;
    END IF;


    /*
     * IN_REVIEW -> VERIFIED
     */
    IF
        OLD.status = 'IN_REVIEW'

        AND

        NEW.status = 'VERIFIED'
    THEN
        PERFORM
            procureiq_fro78_validate_complete(
                OLD.id
            );


        /*
         * Review evidence is immutable once recorded.
         */
        IF
            NEW.review_submitted_by_user_id
                IS DISTINCT FROM OLD.review_submitted_by_user_id

            OR

            NEW.review_submitted_at
                IS DISTINCT FROM OLD.review_submitted_at
        THEN
            RAISE EXCEPTION
                'Verification cannot alter submission evidence';
        END IF;


        IF
            NEW.verified_by_user_id IS NULL

            OR

            NEW.verified_at IS NULL

            OR

            BTRIM(
                COALESCE(
                    NEW.verification_note,
                    ''
                )
            ) = ''
        THEN
            RAISE EXCEPTION
                'Manager verification evidence is required';
        END IF;


        /*
         * Verification cannot pre-populate or alter closure evidence.
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
                'Verification cannot alter closure evidence';
        END IF;


        RETURN NEW;
    END IF;


    /*
     * VERIFIED -> CLOSED
     */
    IF
        OLD.status = 'VERIFIED'

        AND

        NEW.status = 'CLOSED'
    THEN
        /*
         * All prior governance evidence remains immutable at closure.
         */
        IF
            NEW.review_submitted_by_user_id
                IS DISTINCT FROM OLD.review_submitted_by_user_id

            OR

            NEW.review_submitted_at
                IS DISTINCT FROM OLD.review_submitted_at

            OR

            NEW.verified_by_user_id
                IS DISTINCT FROM OLD.verified_by_user_id

            OR

            NEW.verified_at
                IS DISTINCT FROM OLD.verified_at

            OR

            NEW.verification_note
                IS DISTINCT FROM OLD.verification_note
        THEN
            RAISE EXCEPTION
                'Closure cannot alter submission or verification evidence';
        END IF;


        IF
            procureiq_fro78_remaining_residual(
                OLD.id
            )
            <> 0
        THEN
            RAISE EXCEPTION
                'Outcome case cannot close while financial residual remains';
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
                'Outcome closure evidence is required';
        END IF;


        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Invalid remediation outcome lifecycle transition: % -> %',
        OLD.status,
        NEW.status;
END;
$$;


/*
 * ---------------------------------------------------------------------------
 * SNAPSHOT INSERT AUTHORITY
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fro79_validate_snapshot_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    authoritative_number VARCHAR(80);

    authoritative_title VARCHAR(240);

    authoritative_currency VARCHAR(3);

    authoritative_year INTEGER;

    authoritative_source NUMERIC(20, 2);

    authoritative_source_count INTEGER;

    authoritative_status VARCHAR(30);

    actual_count INTEGER;

    actual_unresolved INTEGER;

    actual_source NUMERIC(20, 2);

    actual_resolved NUMERIC(20, 2);

    actual_remaining NUMERIC(20, 2);
BEGIN
    SELECT
        outcome_number,
        title,
        currency,
        fiscal_year,
        source_residual_amount,
        source_item_count,
        status

    INTO
        authoritative_number,
        authoritative_title,
        authoritative_currency,
        authoritative_year,
        authoritative_source,
        authoritative_source_count,
        authoritative_status

    FROM procurement_remediation_outcome_cases

    WHERE id =
        NEW.outcome_case_id

    FOR SHARE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Remediation outcome case does not exist for snapshot';
    END IF;


    IF NEW.sealed THEN
        RAISE EXCEPTION
            'Remediation outcome snapshot must be created unsealed';
    END IF;


    SELECT
        COUNT(*),

        COUNT(*)
        FILTER (
            WHERE remaining_residual_amount > 0
        ),

        COALESCE(
            SUM(
                source_residual_amount
            ),
            0
        ),

        COALESCE(
            SUM(
                resolved_amount
            ),
            0
        ),

        COALESCE(
            SUM(
                remaining_residual_amount
            ),
            0
        )

    INTO
        actual_count,
        actual_unresolved,
        actual_source,
        actual_resolved,
        actual_remaining

    FROM procurement_remediation_outcome_items

    WHERE outcome_case_id =
        NEW.outcome_case_id;


    /*
     * A sealed evidence snapshot represents the complete outcome case,
     * therefore partial evidence coverage cannot produce a snapshot.
     */
    IF actual_count <> authoritative_source_count THEN
        RAISE EXCEPTION
            'Remediation outcome snapshot requires complete outcome evidence coverage';
    END IF;


    IF
        actual_source <> authoritative_source

        OR

        actual_resolved
            + actual_remaining
            <> authoritative_source
    THEN
        RAISE EXCEPTION
            'Remediation outcome case metrics do not reconcile for snapshot';
    END IF;


    IF
        NEW.outcome_number
            IS DISTINCT FROM authoritative_number

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

        NEW.source_residual_amount
            IS DISTINCT FROM authoritative_source

        OR

        NEW.resolved_amount
            IS DISTINCT FROM actual_resolved

        OR

        NEW.remaining_residual_amount
            IS DISTINCT FROM actual_remaining

        OR

        NEW.item_count
            IS DISTINCT FROM actual_count

        OR

        NEW.unresolved_item_count
            IS DISTINCT FROM actual_unresolved

        OR

        NEW.outcome_status
            IS DISTINCT FROM authoritative_status
    THEN
        RAISE EXCEPTION
            'Remediation outcome snapshot header does not match authoritative case state';
    END IF;


    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS
    trg_fro79_validate_snapshot_insert
ON procurement_remediation_outcome_snapshots;


CREATE TRIGGER trg_fro79_validate_snapshot_insert

BEFORE INSERT

ON procurement_remediation_outcome_snapshots

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fro79_validate_snapshot_insert();


/*
 * ---------------------------------------------------------------------------
 * SNAPSHOT ITEM AUTHORITY
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fro78_snapshot_item_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    snapshot_is_sealed BOOLEAN;

    snapshot_case_id UUID;

    authoritative_case_id UUID;

    authoritative_source_item_id UUID;

    authoritative_action VARCHAR(50);

    authoritative_source_amount NUMERIC(20, 2);

    authoritative_resolution VARCHAR(50);

    authoritative_resolved NUMERIC(20, 2);

    authoritative_remaining NUMERIC(20, 2);

    authoritative_observed DATE;

    authoritative_reference VARCHAR(500);

    authoritative_note VARCHAR(2500);
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT
            sealed,
            outcome_case_id

        INTO
            snapshot_is_sealed,
            snapshot_case_id

        FROM procurement_remediation_outcome_snapshots

        WHERE id =
            NEW.snapshot_id

        FOR UPDATE;


        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Remediation outcome snapshot does not exist';
        END IF;


        IF snapshot_is_sealed THEN
            RAISE EXCEPTION
                'Cannot append to a sealed remediation outcome snapshot';
        END IF;


        SELECT
            outcome_case_id,
            source_remediation_item_id,
            source_action,
            source_residual_amount,
            resolution_type,
            resolved_amount,
            remaining_residual_amount,
            observed_on,
            evidence_reference,
            evidence_note

        INTO
            authoritative_case_id,
            authoritative_source_item_id,
            authoritative_action,
            authoritative_source_amount,
            authoritative_resolution,
            authoritative_resolved,
            authoritative_remaining,
            authoritative_observed,
            authoritative_reference,
            authoritative_note

        FROM procurement_remediation_outcome_items

        WHERE id =
            NEW.outcome_item_id

        FOR SHARE;


        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Authoritative remediation outcome item does not exist';
        END IF;


        IF authoritative_case_id <> snapshot_case_id THEN
            RAISE EXCEPTION
                'Snapshot item belongs to another remediation outcome case';
        END IF;


        IF
            NEW.source_remediation_item_id
                IS DISTINCT FROM authoritative_source_item_id

            OR

            NEW.source_action
                IS DISTINCT FROM authoritative_action

            OR

            NEW.source_residual_amount
                IS DISTINCT FROM authoritative_source_amount

            OR

            NEW.resolution_type
                IS DISTINCT FROM authoritative_resolution

            OR

            NEW.resolved_amount
                IS DISTINCT FROM authoritative_resolved

            OR

            NEW.remaining_residual_amount
                IS DISTINCT FROM authoritative_remaining

            OR

            NEW.observed_on
                IS DISTINCT FROM authoritative_observed

            OR

            NEW.evidence_reference
                IS DISTINCT FROM authoritative_reference

            OR

            NEW.evidence_note
                IS DISTINCT FROM authoritative_note
        THEN
            RAISE EXCEPTION
                'Snapshot item does not match authoritative remediation outcome evidence';
        END IF;


        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Remediation outcome snapshot items are immutable';
END;
$$;


/*
 * ---------------------------------------------------------------------------
 * SNAPSHOT SEALING AUTHORITY
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fro78_snapshot_header_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    expected_source_count INTEGER;

    actual_count INTEGER;

    actual_unresolved INTEGER;

    actual_source NUMERIC(20, 2);

    actual_resolved NUMERIC(20, 2);

    actual_remaining NUMERIC(20, 2);
BEGIN
    IF
        TG_OP = 'UPDATE'

        AND

        OLD.sealed = FALSE

        AND

        NEW.sealed = TRUE
    THEN
        /*
         * Sealing is the only permitted update and must not mutate
         * any snapshot content.
         */
        IF
            NEW.id
                IS DISTINCT FROM OLD.id

            OR

            NEW.snapshot_number
                IS DISTINCT FROM OLD.snapshot_number

            OR

            NEW.outcome_case_id
                IS DISTINCT FROM OLD.outcome_case_id

            OR

            NEW.outcome_number
                IS DISTINCT FROM OLD.outcome_number

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

            NEW.source_residual_amount
                IS DISTINCT FROM OLD.source_residual_amount

            OR

            NEW.resolved_amount
                IS DISTINCT FROM OLD.resolved_amount

            OR

            NEW.remaining_residual_amount
                IS DISTINCT FROM OLD.remaining_residual_amount

            OR

            NEW.item_count
                IS DISTINCT FROM OLD.item_count

            OR

            NEW.unresolved_item_count
                IS DISTINCT FROM OLD.unresolved_item_count

            OR

            NEW.outcome_status
                IS DISTINCT FROM OLD.outcome_status

            OR

            NEW.captured_by_user_id
                IS DISTINCT FROM OLD.captured_by_user_id

            OR

            NEW.captured_at
                IS DISTINCT FROM OLD.captured_at
        THEN
            RAISE EXCEPTION
                'Snapshot content cannot change while sealing';
        END IF;


        SELECT
            source_item_count

        INTO
            expected_source_count

        FROM procurement_remediation_outcome_cases

        WHERE id =
            OLD.outcome_case_id;


        IF expected_source_count IS NULL THEN
            RAISE EXCEPTION
                'Snapshot outcome case does not exist';
        END IF;


        SELECT
            COUNT(*),

            COUNT(*)
            FILTER (
                WHERE remaining_residual_amount > 0
            ),

            COALESCE(
                SUM(
                    source_residual_amount
                ),
                0
            ),

            COALESCE(
                SUM(
                    resolved_amount
                ),
                0
            ),

            COALESCE(
                SUM(
                    remaining_residual_amount
                ),
                0
            )

        INTO
            actual_count,
            actual_unresolved,
            actual_source,
            actual_resolved,
            actual_remaining

        FROM procurement_remediation_outcome_snapshot_items

        WHERE snapshot_id =
            OLD.id;


        IF
            actual_count <> expected_source_count

            OR

            actual_count <> NEW.item_count

            OR

            actual_unresolved <> NEW.unresolved_item_count

            OR

            actual_source <> NEW.source_residual_amount

            OR

            actual_resolved <> NEW.resolved_amount

            OR

            actual_remaining <> NEW.remaining_residual_amount

            OR

            actual_resolved
                + actual_remaining
                <> NEW.source_residual_amount
        THEN
            RAISE EXCEPTION
                'Remediation outcome snapshot does not reconcile';
        END IF;


        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Remediation outcome snapshots are immutable after creation';
END;
$$;
