/*
 * STEP 88
 * CONTINUATION OUTCOME RUNTIME INTEGRITY HARDENING
 *
 * V79 remains immutable.
 */


/*
 * ---------------------------------------------------------------------------
 * STRICT CASE CREATION AUTHORITY
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fco87_validate_case_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    authoritative_status VARCHAR(30);
    authoritative_number VARCHAR(80);
    authoritative_title VARCHAR(240);
    authoritative_currency VARCHAR(3);
    authoritative_year INTEGER;
    authoritative_amount NUMERIC(20, 2);
    authoritative_count INTEGER;

    actual_amount NUMERIC(20, 2);
    actual_count INTEGER;
BEGIN
    IF
        NEW.status <> 'DRAFT'
        OR
        NEW.version <> 0
    THEN
        RAISE EXCEPTION
            'Continuation outcome cases must be created as DRAFT version zero';
    END IF;


    IF
        NEW.residual_disposition IS NOT NULL

        OR

        NEW.verified_remaining_residual_amount IS NOT NULL

        OR

        NEW.review_submitted_by_user_id IS NOT NULL

        OR

        NEW.review_submitted_at IS NOT NULL

        OR

        NEW.verified_by_user_id IS NOT NULL

        OR

        NEW.verified_at IS NOT NULL

        OR

        NEW.verification_note IS NOT NULL

        OR

        NEW.closed_by_user_id IS NOT NULL

        OR

        NEW.closed_at IS NOT NULL

        OR

        NEW.close_note IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Continuation outcome lifecycle evidence cannot be pre-populated';
    END IF;


    SELECT
        continuation.status,
        continuation.continuation_number,
        continuation.title,
        continuation.currency,
        continuation.fiscal_year,
        continuation.source_remaining_residual_amount,
        continuation.source_residual_item_count

    INTO
        authoritative_status,
        authoritative_number,
        authoritative_title,
        authoritative_currency,
        authoritative_year,
        authoritative_amount,
        authoritative_count

    FROM procurement_remediation_continuation_cases continuation

    WHERE continuation.id =
        NEW.source_continuation_case_id

    FOR SHARE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source continuation case does not exist';
    END IF;


    IF authoritative_status <> 'CLOSED' THEN
        RAISE EXCEPTION
            'Continuation outcome requires CLOSED source continuation';
    END IF;


    SELECT
        COALESCE(
            SUM(
                item.source_remaining_residual_amount
            ),
            0
        ),
        COUNT(*)

    INTO
        actual_amount,
        actual_count

    FROM procurement_remediation_continuation_items item

    WHERE item.continuation_case_id =
        NEW.source_continuation_case_id;


    IF
        actual_amount <> authoritative_amount

        OR

        actual_count <> authoritative_count
    THEN
        RAISE EXCEPTION
            'Closed continuation source authority does not reconcile';
    END IF;


    IF
        NEW.source_continuation_number
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
            IS DISTINCT FROM authoritative_amount

        OR

        NEW.source_item_count
            IS DISTINCT FROM authoritative_count
    THEN
        RAISE EXCEPTION
            'Continuation outcome source authority does not reconcile';
    END IF;


    RETURN NEW;
END;
$$;


/*
 * ---------------------------------------------------------------------------
 * STRICT LIFECYCLE AUTHORITY
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fco87_protect_case_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    authoritative_remaining NUMERIC(20, 2);
    expected_disposition VARCHAR(50);
BEGIN
    IF
        NEW.id
            IS DISTINCT FROM OLD.id

        OR

        NEW.outcome_number
            IS DISTINCT FROM OLD.outcome_number

        OR

        NEW.source_continuation_case_id
            IS DISTINCT FROM OLD.source_continuation_case_id

        OR

        NEW.source_continuation_number
            IS DISTINCT FROM OLD.source_continuation_number

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
            'Continuation outcome source authority is immutable';
    END IF;


    IF NEW.version <> OLD.version + 1 THEN
        RAISE EXCEPTION
            'Continuation outcome version must increment exactly once';
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
            procureiq_fco87_validate_complete(
                OLD.id
            );


        IF
            OLD.review_submitted_by_user_id IS NOT NULL

            OR

            OLD.review_submitted_at IS NOT NULL

            OR

            OLD.verified_by_user_id IS NOT NULL

            OR

            OLD.verified_at IS NOT NULL

            OR

            OLD.verification_note IS NOT NULL

            OR

            OLD.residual_disposition IS NOT NULL

            OR

            OLD.verified_remaining_residual_amount IS NOT NULL

            OR

            OLD.closed_by_user_id IS NOT NULL

            OR

            OLD.closed_at IS NOT NULL

            OR

            OLD.close_note IS NOT NULL
        THEN
            RAISE EXCEPTION
                'DRAFT continuation outcome contains unexpected lifecycle evidence';
        END IF;


        IF
            NEW.review_submitted_by_user_id IS NULL

            OR

            NEW.review_submitted_at IS NULL
        THEN
            RAISE EXCEPTION
                'Outcome review submission evidence is required';
        END IF;


        IF
            NEW.verified_by_user_id IS NOT NULL

            OR

            NEW.verified_at IS NOT NULL

            OR

            NEW.verification_note IS NOT NULL

            OR

            NEW.residual_disposition IS NOT NULL

            OR

            NEW.verified_remaining_residual_amount IS NOT NULL

            OR

            NEW.closed_by_user_id IS NOT NULL

            OR

            NEW.closed_at IS NOT NULL

            OR

            NEW.close_note IS NOT NULL
        THEN
            RAISE EXCEPTION
                'Submission cannot pre-populate verification or closure evidence';
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
            procureiq_fco87_validate_complete(
                OLD.id
            );


        SELECT
            COALESCE(
                SUM(
                    remaining_residual_amount
                ),
                0
            )

        INTO
            authoritative_remaining

        FROM procurement_remediation_continuation_outcome_items

        WHERE outcome_case_id =
            OLD.id;


        expected_disposition =
            CASE
                WHEN authoritative_remaining = 0
                THEN 'FULLY_RESOLVED'

                ELSE 'FURTHER_GOVERNANCE_REQUIRED'
            END;


        IF
            OLD.verified_by_user_id IS NOT NULL

            OR

            OLD.verified_at IS NOT NULL

            OR

            OLD.verification_note IS NOT NULL

            OR

            OLD.residual_disposition IS NOT NULL

            OR

            OLD.verified_remaining_residual_amount IS NOT NULL

            OR

            OLD.closed_by_user_id IS NOT NULL

            OR

            OLD.closed_at IS NOT NULL

            OR

            OLD.close_note IS NOT NULL
        THEN
            RAISE EXCEPTION
                'IN_REVIEW continuation outcome contains unexpected later lifecycle evidence';
        END IF;


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


        IF
            NEW.verified_remaining_residual_amount
                IS DISTINCT FROM authoritative_remaining

            OR

            NEW.residual_disposition
                IS DISTINCT FROM expected_disposition
        THEN
            RAISE EXCEPTION
                'Verified residual disposition does not match observed evidence';
        END IF;


        IF
            NEW.closed_by_user_id IS NOT NULL

            OR

            NEW.closed_at IS NOT NULL

            OR

            NEW.close_note IS NOT NULL
        THEN
            RAISE EXCEPTION
                'Verification cannot pre-populate closure evidence';
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
        PERFORM
            procureiq_fco87_validate_complete(
                OLD.id
            );


        SELECT
            COALESCE(
                SUM(
                    remaining_residual_amount
                ),
                0
            )

        INTO
            authoritative_remaining

        FROM procurement_remediation_continuation_outcome_items

        WHERE outcome_case_id =
            OLD.id;


        IF
            authoritative_remaining <> 0

            OR

            OLD.residual_disposition
                <>
                'FULLY_RESOLVED'

            OR

            OLD.verified_remaining_residual_amount
                IS DISTINCT FROM 0::NUMERIC
        THEN
            RAISE EXCEPTION
                'Positive residual requires further governance and cannot be closed';
        END IF;


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

            OR

            NEW.residual_disposition
                IS DISTINCT FROM OLD.residual_disposition

            OR

            NEW.verified_remaining_residual_amount
                IS DISTINCT FROM OLD.verified_remaining_residual_amount
        THEN
            RAISE EXCEPTION
                'Closure cannot alter prior outcome evidence';
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
        'Invalid continuation outcome lifecycle transition: % -> %',
        OLD.status,
        NEW.status;
END;
$$;


/*
 * ---------------------------------------------------------------------------
 * STRICT SNAPSHOT SEALING RECONCILIATION
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fco87_snapshot_header_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    snapshot_item_count INTEGER;
    snapshot_source_amount NUMERIC(20, 2);
    snapshot_remaining_amount NUMERIC(20, 2);

    authoritative_item_count INTEGER;
    authoritative_source_amount NUMERIC(20, 2);
    authoritative_remaining_amount NUMERIC(20, 2);
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

            NEW.outcome_case_id
                IS DISTINCT FROM OLD.outcome_case_id

            OR

            NEW.outcome_number
                IS DISTINCT FROM OLD.outcome_number

            OR

            NEW.source_continuation_case_id
                IS DISTINCT FROM OLD.source_continuation_case_id

            OR

            NEW.source_continuation_number
                IS DISTINCT FROM OLD.source_continuation_number

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

            NEW.remaining_residual_amount
                IS DISTINCT FROM OLD.remaining_residual_amount

            OR

            NEW.item_count
                IS DISTINCT FROM OLD.item_count

            OR

            NEW.outcome_status
                IS DISTINCT FROM OLD.outcome_status

            OR

            NEW.residual_disposition
                IS DISTINCT FROM OLD.residual_disposition

            OR

            NEW.captured_by_user_id
                IS DISTINCT FROM OLD.captured_by_user_id

            OR

            NEW.captured_at
                IS DISTINCT FROM OLD.captured_at
        THEN
            RAISE EXCEPTION
                'Outcome snapshot content cannot change while sealing';
        END IF;


        PERFORM
            procureiq_fco87_validate_complete(
                OLD.outcome_case_id
            );


        SELECT
            COUNT(*),
            COALESCE(
                SUM(
                    source_residual_amount
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
            authoritative_item_count,
            authoritative_source_amount,
            authoritative_remaining_amount

        FROM procurement_remediation_continuation_outcome_items

        WHERE outcome_case_id =
            OLD.outcome_case_id;


        SELECT
            COUNT(*),
            COALESCE(
                SUM(
                    source_residual_amount
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
            snapshot_item_count,
            snapshot_source_amount,
            snapshot_remaining_amount

        FROM procurement_remediation_continuation_outcome_snapshot_items

        WHERE snapshot_id =
            OLD.id;


        IF
            snapshot_item_count <> authoritative_item_count

            OR

            snapshot_item_count <> NEW.item_count

            OR

            snapshot_source_amount <> authoritative_source_amount

            OR

            snapshot_source_amount <> NEW.source_residual_amount

            OR

            snapshot_remaining_amount <> authoritative_remaining_amount

            OR

            snapshot_remaining_amount <> NEW.remaining_residual_amount
        THEN
            RAISE EXCEPTION
                'Continuation outcome snapshot does not reconcile';
        END IF;


        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Continuation outcome snapshots are immutable after creation';
END;
$$;


/*
 * ---------------------------------------------------------------------------
 * STEP 88 RECOVERY V3
 * SNAPSHOT INSERT AUTHORITY — POSTGRESQL LOCKING REPAIR
 *
 * V79 combined GROUP BY with FOR SHARE OF outcome.
 * PostgreSQL does not permit row-locking clauses on grouped queries.
 *
 * Read/lock authoritative case state first, then aggregate immutable evidence
 * in a separate statement.
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fco87_snapshot_insert_guard()
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
    authoritative_source_amount NUMERIC(20, 2);
    authoritative_status VARCHAR(30);
    authoritative_disposition VARCHAR(50);
    authoritative_count INTEGER;
    authoritative_remaining NUMERIC(20, 2);
BEGIN
    /*
     * Evidence coverage must already reconcile to the source continuation.
     */
    PERFORM
        procureiq_fco87_validate_complete(
            NEW.outcome_case_id
        );


    /*
     * Lock only the authoritative outcome-case row.
     *
     * This intentionally contains no aggregation, so PostgreSQL can apply
     * FOR SHARE safely.
     *
     * Continuation-outcome item insertion locks the same case row FOR UPDATE,
     * preventing a concurrent evidence append from crossing snapshot capture.
     */
    SELECT
        outcome.outcome_number,
        outcome.source_continuation_case_id,
        outcome.source_continuation_number,
        outcome.title,
        outcome.currency,
        outcome.fiscal_year,
        outcome.source_residual_amount,
        outcome.status,
        outcome.residual_disposition,
        outcome.source_item_count

    INTO
        authoritative_number,
        authoritative_source_case_id,
        authoritative_source_number,
        authoritative_title,
        authoritative_currency,
        authoritative_year,
        authoritative_source_amount,
        authoritative_status,
        authoritative_disposition,
        authoritative_count

    FROM procurement_remediation_continuation_outcome_cases outcome

    WHERE outcome.id =
        NEW.outcome_case_id

    FOR SHARE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Continuation outcome case does not exist for snapshot';
    END IF;


    /*
     * Outcome evidence is immutable once inserted.
     *
     * Aggregate it separately from the case-row locking query so no grouped
     * SELECT carries a PostgreSQL row-locking clause.
     */
    SELECT
        COALESCE(
            SUM(
                item.remaining_residual_amount
            ),
            0
        )

    INTO
        authoritative_remaining

    FROM procurement_remediation_continuation_outcome_items item

    WHERE item.outcome_case_id =
        NEW.outcome_case_id;


    IF NEW.sealed THEN
        RAISE EXCEPTION
            'Continuation outcome snapshot must be created unsealed';
    END IF;


    IF
        NEW.outcome_number
            IS DISTINCT FROM authoritative_number

        OR

        NEW.source_continuation_case_id
            IS DISTINCT FROM authoritative_source_case_id

        OR

        NEW.source_continuation_number
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

        NEW.source_residual_amount
            IS DISTINCT FROM authoritative_source_amount

        OR

        NEW.remaining_residual_amount
            IS DISTINCT FROM authoritative_remaining

        OR

        NEW.item_count
            IS DISTINCT FROM authoritative_count

        OR

        NEW.outcome_status
            IS DISTINCT FROM authoritative_status

        OR

        NEW.residual_disposition
            IS DISTINCT FROM authoritative_disposition
    THEN
        RAISE EXCEPTION
            'Continuation outcome snapshot header does not match authority';
    END IF;


    RETURN NEW;
END;
$$;
