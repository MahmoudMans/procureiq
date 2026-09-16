/*
 * STEP 87
 * CONTINUATION OUTCOME EVIDENCE & RESIDUAL RE-EVALUATION
 *
 * This layer consumes CLOSED residual-continuation governance.
 *
 * It records observed evidence only.
 *
 * It does NOT execute:
 *   - collections
 *   - payments
 *   - refunds
 *   - write-offs
 *   - accounting postings
 */

CREATE SEQUENCE procurement_continuation_outcome_number_seq
    START WITH 1
    INCREMENT BY 1;


CREATE SEQUENCE procurement_continuation_outcome_snapshot_seq
    START WITH 1
    INCREMENT BY 1;


/*
 * ---------------------------------------------------------------------------
 * OUTCOME CASE
 * ---------------------------------------------------------------------------
 */

CREATE TABLE procurement_remediation_continuation_outcome_cases (
    id UUID PRIMARY KEY,

    outcome_number
        VARCHAR(80)
        NOT NULL
        UNIQUE,

    source_continuation_case_id
        UUID
        NOT NULL,

    source_continuation_number
        VARCHAR(80)
        NOT NULL,

    title
        VARCHAR(240)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    source_residual_amount
        NUMERIC(20, 2)
        NOT NULL,

    source_item_count
        INTEGER
        NOT NULL,

    owner_user_id
        UUID
        NOT NULL,

    owner_name
        VARCHAR(240)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL
        DEFAULT 'DRAFT',

    residual_disposition
        VARCHAR(50),

    verified_remaining_residual_amount
        NUMERIC(20, 2),

    review_submitted_by_user_id
        UUID,

    review_submitted_at
        TIMESTAMPTZ,

    verified_by_user_id
        UUID,

    verified_at
        TIMESTAMPTZ,

    verification_note
        VARCHAR(2500),

    closed_by_user_id
        UUID,

    closed_at
        TIMESTAMPTZ,

    close_note
        VARCHAR(2500),

    version
        BIGINT
        NOT NULL
        DEFAULT 0,

    created_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at
        TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_continuation_outcome_source_case
        FOREIGN KEY (
            source_continuation_case_id
        )
        REFERENCES procurement_remediation_continuation_cases (id),

    CONSTRAINT fk_continuation_outcome_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_continuation_outcome_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_continuation_outcome_submitter
        FOREIGN KEY (
            review_submitted_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_continuation_outcome_verifier
        FOREIGN KEY (
            verified_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_continuation_outcome_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_continuation_outcome_source_case
        UNIQUE (
            source_continuation_case_id
        ),

    CONSTRAINT ck_continuation_outcome_status
        CHECK (
            status IN (
                'DRAFT',
                'IN_REVIEW',
                'VERIFIED',
                'CLOSED'
            )
        ),

    CONSTRAINT ck_continuation_outcome_disposition
        CHECK (
            residual_disposition IS NULL
            OR
            residual_disposition IN (
                'FULLY_RESOLVED',
                'FURTHER_GOVERNANCE_REQUIRED'
            )
        ),

    CONSTRAINT ck_continuation_outcome_source_amount
        CHECK (
            source_residual_amount > 0
        ),

    CONSTRAINT ck_continuation_outcome_source_count
        CHECK (
            source_item_count > 0
        ),

    CONSTRAINT ck_continuation_outcome_verified_residual
        CHECK (
            verified_remaining_residual_amount IS NULL
            OR
            verified_remaining_residual_amount >= 0
        )
);


/*
 * ---------------------------------------------------------------------------
 * OUTCOME ITEMS
 * ---------------------------------------------------------------------------
 */

CREATE TABLE procurement_remediation_continuation_outcome_items (
    id UUID PRIMARY KEY,

    outcome_case_id
        UUID
        NOT NULL,

    source_continuation_item_id
        UUID
        NOT NULL,

    source_continuation_action
        VARCHAR(50)
        NOT NULL,

    source_residual_amount
        NUMERIC(20, 2)
        NOT NULL,

    resolution_type
        VARCHAR(50)
        NOT NULL,

    observed_reduction_amount
        NUMERIC(20, 2)
        NOT NULL,

    remaining_residual_amount
        NUMERIC(20, 2)
        NOT NULL,

    observed_on
        DATE
        NOT NULL,

    evidence_reference
        VARCHAR(500)
        NOT NULL,

    evidence_note
        VARCHAR(2500)
        NOT NULL,

    created_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_continuation_outcome_item_case
        FOREIGN KEY (
            outcome_case_id
        )
        REFERENCES procurement_remediation_continuation_outcome_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_continuation_outcome_source_item
        FOREIGN KEY (
            source_continuation_item_id
        )
        REFERENCES procurement_remediation_continuation_items (id),

    CONSTRAINT fk_continuation_outcome_item_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_continuation_outcome_source_item
        UNIQUE (
            source_continuation_item_id
        ),

    CONSTRAINT ck_continuation_outcome_resolution
        CHECK (
            resolution_type IN (
                'RECOVERY_CONFIRMED',
                'WRITE_OFF_CONFIRMED',
                'INVESTIGATION_CONCLUDED',
                'RISK_ACCEPTANCE_CONFIRMED',
                'PARTIAL',
                'UNRESOLVED'
            )
        ),

    CONSTRAINT ck_continuation_outcome_item_amounts
        CHECK (
            source_residual_amount > 0
            AND
            observed_reduction_amount >= 0
            AND
            observed_reduction_amount <= source_residual_amount
            AND
            remaining_residual_amount >= 0
            AND
            remaining_residual_amount =
                source_residual_amount
                - observed_reduction_amount
        )
);


CREATE INDEX idx_continuation_outcome_case_status
    ON procurement_remediation_continuation_outcome_cases (
        status,
        created_at DESC
    );


CREATE INDEX idx_continuation_outcome_source_case
    ON procurement_remediation_continuation_outcome_cases (
        source_continuation_case_id
    );


CREATE INDEX idx_continuation_outcome_item_case
    ON procurement_remediation_continuation_outcome_items (
        outcome_case_id
    );


/*
 * ---------------------------------------------------------------------------
 * SNAPSHOTS
 * ---------------------------------------------------------------------------
 */

CREATE TABLE procurement_remediation_continuation_outcome_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number
        VARCHAR(80)
        NOT NULL
        UNIQUE,

    outcome_case_id
        UUID
        NOT NULL,

    outcome_number
        VARCHAR(80)
        NOT NULL,

    source_continuation_case_id
        UUID
        NOT NULL,

    source_continuation_number
        VARCHAR(80)
        NOT NULL,

    title
        VARCHAR(240)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    source_residual_amount
        NUMERIC(20, 2)
        NOT NULL,

    remaining_residual_amount
        NUMERIC(20, 2)
        NOT NULL,

    item_count
        INTEGER
        NOT NULL,

    outcome_status
        VARCHAR(30)
        NOT NULL,

    residual_disposition
        VARCHAR(50),

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    sealed
        BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    CONSTRAINT fk_continuation_outcome_snapshot_case
        FOREIGN KEY (
            outcome_case_id
        )
        REFERENCES procurement_remediation_continuation_outcome_cases (id),

    CONSTRAINT fk_continuation_outcome_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_continuation_outcome_snapshot_amounts
        CHECK (
            source_residual_amount > 0
            AND
            remaining_residual_amount >= 0
            AND
            remaining_residual_amount <= source_residual_amount
        ),

    CONSTRAINT ck_continuation_outcome_snapshot_count
        CHECK (
            item_count > 0
        ),

    CONSTRAINT ck_continuation_outcome_snapshot_status
        CHECK (
            outcome_status IN (
                'DRAFT',
                'IN_REVIEW',
                'VERIFIED',
                'CLOSED'
            )
        ),

    CONSTRAINT ck_continuation_outcome_snapshot_disposition
        CHECK (
            residual_disposition IS NULL
            OR
            residual_disposition IN (
                'FULLY_RESOLVED',
                'FURTHER_GOVERNANCE_REQUIRED'
            )
        )
);


CREATE TABLE procurement_remediation_continuation_outcome_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    outcome_item_id
        UUID
        NOT NULL,

    source_continuation_item_id
        UUID
        NOT NULL,

    source_continuation_action
        VARCHAR(50)
        NOT NULL,

    source_residual_amount
        NUMERIC(20, 2)
        NOT NULL,

    resolution_type
        VARCHAR(50)
        NOT NULL,

    observed_reduction_amount
        NUMERIC(20, 2)
        NOT NULL,

    remaining_residual_amount
        NUMERIC(20, 2)
        NOT NULL,

    observed_on
        DATE
        NOT NULL,

    evidence_reference
        VARCHAR(500)
        NOT NULL,

    evidence_note
        VARCHAR(2500)
        NOT NULL,

    CONSTRAINT fk_continuation_outcome_snapshot_item
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_remediation_continuation_outcome_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_continuation_outcome_snapshot_item
        UNIQUE (
            snapshot_id,
            outcome_item_id
        )
);


CREATE INDEX idx_continuation_outcome_snapshot_case
    ON procurement_remediation_continuation_outcome_snapshots (
        outcome_case_id,
        captured_at DESC
    );


/*
 * ---------------------------------------------------------------------------
 * CASE INSERT AUTHORITY
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
        NEW.source_continuation_case_id;


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


    IF
        NEW.residual_disposition IS NOT NULL

        OR

        NEW.verified_remaining_residual_amount IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Residual disposition is established only during verification';
    END IF;


    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_fco87_validate_case_insert

BEFORE INSERT

ON procurement_remediation_continuation_outcome_cases

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fco87_validate_case_insert();


/*
 * ---------------------------------------------------------------------------
 * ITEM INSERT AUTHORITY
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fco87_validate_item_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    outcome_status VARCHAR(30);
    source_case_id UUID;
    authoritative_case_id UUID;
    authoritative_action VARCHAR(50);
    authoritative_amount NUMERIC(20, 2);
    compatible BOOLEAN;
BEGIN
    SELECT
        status,
        source_continuation_case_id

    INTO
        outcome_status,
        source_case_id

    FROM procurement_remediation_continuation_outcome_cases

    WHERE id =
        NEW.outcome_case_id

    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Continuation outcome case does not exist';
    END IF;


    IF outcome_status <> 'DRAFT' THEN
        RAISE EXCEPTION
            'Continuation outcome evidence can be added only while DRAFT';
    END IF;


    SELECT
        continuation_case_id,
        continuation_action,
        source_remaining_residual_amount

    INTO
        authoritative_case_id,
        authoritative_action,
        authoritative_amount

    FROM procurement_remediation_continuation_items

    WHERE id =
        NEW.source_continuation_item_id

    FOR SHARE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source continuation item does not exist';
    END IF;


    IF authoritative_case_id <> source_case_id THEN
        RAISE EXCEPTION
            'Source continuation item belongs to another continuation case';
    END IF;


    IF
        NEW.source_continuation_action
            IS DISTINCT FROM authoritative_action

        OR

        NEW.source_residual_amount
            IS DISTINCT FROM authoritative_amount
    THEN
        RAISE EXCEPTION
            'Continuation outcome item does not match source authority';
    END IF;


    compatible =
        CASE authoritative_action

            WHEN 'RECOVERY_RETRY'
            THEN NEW.resolution_type IN (
                'RECOVERY_CONFIRMED',
                'PARTIAL',
                'UNRESOLVED'
            )

            WHEN 'WRITE_OFF_ESCALATION'
            THEN NEW.resolution_type IN (
                'WRITE_OFF_CONFIRMED',
                'PARTIAL',
                'UNRESOLVED'
            )

            WHEN 'INVESTIGATION_ESCALATION'
            THEN NEW.resolution_type IN (
                'INVESTIGATION_CONCLUDED',
                'PARTIAL',
                'UNRESOLVED'
            )

            WHEN 'RISK_ACCEPTANCE_ESCALATION'
            THEN NEW.resolution_type IN (
                'RISK_ACCEPTANCE_CONFIRMED',
                'UNRESOLVED'
            )

            ELSE FALSE
        END;


    IF NOT compatible THEN
        RAISE EXCEPTION
            'Outcome resolution is incompatible with continuation action';
    END IF;


    IF
        NEW.remaining_residual_amount
        <>
        NEW.source_residual_amount
        -
        NEW.observed_reduction_amount
    THEN
        RAISE EXCEPTION
            'Observed continuation outcome amounts do not reconcile';
    END IF;


    IF
        NEW.resolution_type IN (
            'RECOVERY_CONFIRMED',
            'WRITE_OFF_CONFIRMED'
        )

        AND

        NEW.observed_reduction_amount <= 0
    THEN
        RAISE EXCEPTION
            'Confirmed financial reduction requires positive observed reduction';
    END IF;


    IF
        NEW.resolution_type = 'PARTIAL'

        AND

        (
            NEW.observed_reduction_amount <= 0

            OR

            NEW.observed_reduction_amount >=
                NEW.source_residual_amount
        )
    THEN
        RAISE EXCEPTION
            'PARTIAL outcome requires a positive incomplete reduction';
    END IF;


    IF
        NEW.resolution_type = 'UNRESOLVED'

        AND

        NEW.observed_reduction_amount <> 0
    THEN
        RAISE EXCEPTION
            'UNRESOLVED outcome cannot claim residual reduction';
    END IF;


    IF
        NEW.resolution_type = 'RISK_ACCEPTANCE_CONFIRMED'

        AND

        NEW.observed_reduction_amount <> 0
    THEN
        RAISE EXCEPTION
            'Risk acceptance does not reduce financial residual';
    END IF;


    IF NEW.observed_on > CURRENT_DATE THEN
        RAISE EXCEPTION
            'Observed outcome date cannot be in the future';
    END IF;


    IF
        BTRIM(
            COALESCE(
                NEW.evidence_reference,
                ''
            )
        ) = ''
    THEN
        RAISE EXCEPTION
            'Outcome evidence reference is required';
    END IF;


    IF
        BTRIM(
            COALESCE(
                NEW.evidence_note,
                ''
            )
        ) = ''
    THEN
        RAISE EXCEPTION
            'Outcome evidence note is required';
    END IF;


    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_fco87_validate_item_insert

BEFORE INSERT

ON procurement_remediation_continuation_outcome_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fco87_validate_item_insert();


/*
 * ---------------------------------------------------------------------------
 * IMMUTABLE EVIDENCE
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fco87_protect_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Continuation outcome evidence items are immutable';
END;
$$;


CREATE TRIGGER trg_fco87_protect_item

BEFORE UPDATE OR DELETE

ON procurement_remediation_continuation_outcome_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fco87_protect_item();


/*
 * ---------------------------------------------------------------------------
 * COMPLETE COVERAGE
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fco87_validate_complete(
    requested_case_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    source_case_id UUID;
    expected_count INTEGER;
    expected_amount NUMERIC(20, 2);
    actual_count INTEGER;
    actual_amount NUMERIC(20, 2);
BEGIN
    SELECT
        source_continuation_case_id

    INTO
        source_case_id

    FROM procurement_remediation_continuation_outcome_cases

    WHERE id =
        requested_case_id;


    IF source_case_id IS NULL THEN
        RAISE EXCEPTION
            'Continuation outcome case does not exist';
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
        expected_count,
        expected_amount

    FROM procurement_remediation_continuation_items

    WHERE continuation_case_id =
        source_case_id;


    SELECT
        COUNT(*),
        COALESCE(
            SUM(
                source_residual_amount
            ),
            0
        )

    INTO
        actual_count,
        actual_amount

    FROM procurement_remediation_continuation_outcome_items

    WHERE outcome_case_id =
        requested_case_id;


    IF
        expected_count <> actual_count

        OR

        expected_amount <> actual_amount
    THEN
        RAISE EXCEPTION
            'Every continuation item requires observed outcome evidence';
    END IF;
END;
$$;


/*
 * ---------------------------------------------------------------------------
 * CASE LIFECYCLE
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
            NEW.review_submitted_by_user_id IS NULL

            OR

            NEW.review_submitted_at IS NULL
        THEN
            RAISE EXCEPTION
                'Outcome review submission evidence is required';
        END IF;


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

            NEW.residual_disposition
                IS DISTINCT FROM OLD.residual_disposition

            OR

            NEW.verified_remaining_residual_amount
                IS DISTINCT FROM OLD.verified_remaining_residual_amount

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
                'Submission cannot alter verification or closure evidence';
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
        IF
            OLD.residual_disposition
            <>
            'FULLY_RESOLVED'

            OR

            OLD.verified_remaining_residual_amount <> 0
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


CREATE TRIGGER trg_fco87_protect_case_update

BEFORE UPDATE

ON procurement_remediation_continuation_outcome_cases

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fco87_protect_case_update();


CREATE OR REPLACE FUNCTION procureiq_fco87_protect_case_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Continuation outcome cases cannot be deleted';
END;
$$;


CREATE TRIGGER trg_fco87_protect_case_delete

BEFORE DELETE

ON procurement_remediation_continuation_outcome_cases

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fco87_protect_case_delete();


/*
 * ---------------------------------------------------------------------------
 * SNAPSHOT INSERT
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
    PERFORM
        procureiq_fco87_validate_complete(
            NEW.outcome_case_id
        );


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
        outcome.source_item_count,

        COALESCE(
            SUM(
                item.remaining_residual_amount
            ),
            0
        )

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
        authoritative_count,
        authoritative_remaining

    FROM procurement_remediation_continuation_outcome_cases outcome

    JOIN procurement_remediation_continuation_outcome_items item
        ON item.outcome_case_id =
           outcome.id

    WHERE outcome.id =
        NEW.outcome_case_id

    GROUP BY
        outcome.id

    FOR SHARE OF outcome;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Continuation outcome case does not exist for snapshot';
    END IF;


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


CREATE TRIGGER trg_fco87_snapshot_insert_guard

BEFORE INSERT

ON procurement_remediation_continuation_outcome_snapshots

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fco87_snapshot_insert_guard();


/*
 * ---------------------------------------------------------------------------
 * SNAPSHOT ITEM AUTHORITY
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fco87_snapshot_item_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    snapshot_sealed BOOLEAN;
    snapshot_case_id UUID;

    authoritative_case_id UUID;
    authoritative_source_item_id UUID;
    authoritative_action VARCHAR(50);
    authoritative_source_amount NUMERIC(20, 2);
    authoritative_resolution VARCHAR(50);
    authoritative_reduction NUMERIC(20, 2);
    authoritative_remaining NUMERIC(20, 2);
    authoritative_observed_on DATE;
    authoritative_reference VARCHAR(500);
    authoritative_note VARCHAR(2500);
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT
            sealed,
            outcome_case_id

        INTO
            snapshot_sealed,
            snapshot_case_id

        FROM procurement_remediation_continuation_outcome_snapshots

        WHERE id =
            NEW.snapshot_id

        FOR UPDATE;


        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Continuation outcome snapshot does not exist';
        END IF;


        IF snapshot_sealed THEN
            RAISE EXCEPTION
                'Cannot append to sealed continuation outcome snapshot';
        END IF;


        SELECT
            outcome_case_id,
            source_continuation_item_id,
            source_continuation_action,
            source_residual_amount,
            resolution_type,
            observed_reduction_amount,
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
            authoritative_reduction,
            authoritative_remaining,
            authoritative_observed_on,
            authoritative_reference,
            authoritative_note

        FROM procurement_remediation_continuation_outcome_items

        WHERE id =
            NEW.outcome_item_id

        FOR SHARE;


        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Authoritative continuation outcome item does not exist';
        END IF;


        IF authoritative_case_id <> snapshot_case_id THEN
            RAISE EXCEPTION
                'Snapshot outcome item belongs to another outcome case';
        END IF;


        IF
            NEW.source_continuation_item_id
                IS DISTINCT FROM authoritative_source_item_id

            OR

            NEW.source_continuation_action
                IS DISTINCT FROM authoritative_action

            OR

            NEW.source_residual_amount
                IS DISTINCT FROM authoritative_source_amount

            OR

            NEW.resolution_type
                IS DISTINCT FROM authoritative_resolution

            OR

            NEW.observed_reduction_amount
                IS DISTINCT FROM authoritative_reduction

            OR

            NEW.remaining_residual_amount
                IS DISTINCT FROM authoritative_remaining

            OR

            NEW.observed_on
                IS DISTINCT FROM authoritative_observed_on

            OR

            NEW.evidence_reference
                IS DISTINCT FROM authoritative_reference

            OR

            NEW.evidence_note
                IS DISTINCT FROM authoritative_note
        THEN
            RAISE EXCEPTION
                'Continuation outcome snapshot item does not match authority';
        END IF;


        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Continuation outcome snapshot items are immutable';
END;
$$;


CREATE TRIGGER trg_fco87_snapshot_item_guard

BEFORE INSERT OR UPDATE OR DELETE

ON procurement_remediation_continuation_outcome_snapshot_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fco87_snapshot_item_guard();


/*
 * ---------------------------------------------------------------------------
 * SNAPSHOT SEALING
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fco87_snapshot_header_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    actual_count INTEGER;
    actual_source_amount NUMERIC(20, 2);
    actual_remaining NUMERIC(20, 2);
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
            actual_count,
            actual_source_amount,
            actual_remaining

        FROM procurement_remediation_continuation_outcome_snapshot_items

        WHERE snapshot_id =
            OLD.id;


        IF
            actual_count <> NEW.item_count

            OR

            actual_source_amount <> NEW.source_residual_amount

            OR

            actual_remaining <> NEW.remaining_residual_amount
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


CREATE TRIGGER trg_fco87_snapshot_header_guard

BEFORE UPDATE OR DELETE

ON procurement_remediation_continuation_outcome_snapshots

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fco87_snapshot_header_guard();


/*
 * ---------------------------------------------------------------------------
 * AUDIT
 * ---------------------------------------------------------------------------
 */

CREATE TRIGGER trg_audit_continuation_outcome_cases

AFTER INSERT OR UPDATE OR DELETE

ON procurement_remediation_continuation_outcome_cases

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_capture_audit_event();


CREATE TRIGGER trg_audit_continuation_outcome_items

AFTER INSERT OR UPDATE OR DELETE

ON procurement_remediation_continuation_outcome_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_capture_audit_event();
