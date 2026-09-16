/*
 * PROCUREIQ — STEP 89
 * GOVERNED RESIDUAL-CYCLE ROLLOVER
 *
 * Source:
 *
 *   VERIFIED continuation outcomes with
 *   FURTHER_GOVERNANCE_REQUIRED and positive residual.
 *
 * This layer creates a NEW governance cycle.
 *
 * It does not execute financial transactions.
 */


CREATE SEQUENCE procurement_continuation_rollover_number_seq
    START WITH 1
    INCREMENT BY 1;


CREATE SEQUENCE procurement_continuation_rollover_snapshot_seq
    START WITH 1
    INCREMENT BY 1;


/*
 * ---------------------------------------------------------------------------
 * ROLLOVER CASE
 * ---------------------------------------------------------------------------
 */

CREATE TABLE procurement_remediation_continuation_rollover_cases (
    id UUID PRIMARY KEY,

    rollover_number
        VARCHAR(80)
        NOT NULL
        UNIQUE,

    source_continuation_outcome_case_id
        UUID
        NOT NULL,

    source_continuation_outcome_number
        VARCHAR(80)
        NOT NULL,

    parent_continuation_case_id
        UUID
        NOT NULL,

    parent_continuation_number
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

    source_remaining_residual_amount
        NUMERIC(20, 2)
        NOT NULL,

    source_residual_item_count
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

    review_submitted_by_user_id
        UUID,

    review_submitted_at
        TIMESTAMPTZ,

    approved_by_user_id
        UUID,

    approved_at
        TIMESTAMPTZ,

    approval_note
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

    CONSTRAINT fk_continuation_rollover_source_outcome
        FOREIGN KEY (
            source_continuation_outcome_case_id
        )
        REFERENCES procurement_remediation_continuation_outcome_cases (id),

    CONSTRAINT fk_continuation_rollover_parent_continuation
        FOREIGN KEY (
            parent_continuation_case_id
        )
        REFERENCES procurement_remediation_continuation_cases (id),

    CONSTRAINT fk_continuation_rollover_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_continuation_rollover_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_continuation_rollover_submitter
        FOREIGN KEY (
            review_submitted_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_continuation_rollover_approver
        FOREIGN KEY (
            approved_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_continuation_rollover_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_continuation_rollover_source_outcome
        UNIQUE (
            source_continuation_outcome_case_id
        ),

    CONSTRAINT ck_continuation_rollover_status
        CHECK (
            status IN (
                'DRAFT',
                'IN_REVIEW',
                'APPROVED',
                'CLOSED'
            )
        ),

    CONSTRAINT ck_continuation_rollover_source_amount
        CHECK (
            source_remaining_residual_amount > 0
        ),

    CONSTRAINT ck_continuation_rollover_source_count
        CHECK (
            source_residual_item_count > 0
        )
);


CREATE INDEX idx_continuation_rollover_status
    ON procurement_remediation_continuation_rollover_cases (
        status,
        created_at DESC
    );


CREATE INDEX idx_continuation_rollover_source_outcome
    ON procurement_remediation_continuation_rollover_cases (
        source_continuation_outcome_case_id
    );


/*
 * ---------------------------------------------------------------------------
 * ROLLOVER ITEMS
 * ---------------------------------------------------------------------------
 */

CREATE TABLE procurement_remediation_continuation_rollover_items (
    id UUID PRIMARY KEY,

    rollover_case_id
        UUID
        NOT NULL,

    source_continuation_outcome_item_id
        UUID
        NOT NULL,

    source_continuation_item_id
        UUID
        NOT NULL,

    source_continuation_action
        VARCHAR(50)
        NOT NULL,

    source_resolution_type
        VARCHAR(50)
        NOT NULL,

    source_remaining_residual_amount
        NUMERIC(20, 2)
        NOT NULL,

    continuation_action
        VARCHAR(50)
        NOT NULL,

    target_date
        DATE
        NOT NULL,

    rationale
        VARCHAR(2500)
        NOT NULL,

    created_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_continuation_rollover_item_case
        FOREIGN KEY (
            rollover_case_id
        )
        REFERENCES procurement_remediation_continuation_rollover_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_continuation_rollover_source_outcome_item
        FOREIGN KEY (
            source_continuation_outcome_item_id
        )
        REFERENCES procurement_remediation_continuation_outcome_items (id),

    CONSTRAINT fk_continuation_rollover_source_continuation_item
        FOREIGN KEY (
            source_continuation_item_id
        )
        REFERENCES procurement_remediation_continuation_items (id),

    CONSTRAINT fk_continuation_rollover_item_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_continuation_rollover_source_outcome_item
        UNIQUE (
            source_continuation_outcome_item_id
        ),

    CONSTRAINT ck_continuation_rollover_item_amount
        CHECK (
            source_remaining_residual_amount > 0
        ),

    CONSTRAINT ck_continuation_rollover_action
        CHECK (
            continuation_action IN (
                'RECOVERY_RETRY',
                'WRITE_OFF_ESCALATION',
                'INVESTIGATION_ESCALATION',
                'RISK_ACCEPTANCE_ESCALATION'
            )
        )
);


CREATE INDEX idx_continuation_rollover_item_case
    ON procurement_remediation_continuation_rollover_items (
        rollover_case_id
    );


/*
 * ---------------------------------------------------------------------------
 * SNAPSHOTS
 * ---------------------------------------------------------------------------
 */

CREATE TABLE procurement_remediation_continuation_rollover_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number
        VARCHAR(80)
        NOT NULL
        UNIQUE,

    rollover_case_id
        UUID
        NOT NULL,

    rollover_number
        VARCHAR(80)
        NOT NULL,

    source_continuation_outcome_case_id
        UUID
        NOT NULL,

    source_continuation_outcome_number
        VARCHAR(80)
        NOT NULL,

    parent_continuation_case_id
        UUID
        NOT NULL,

    parent_continuation_number
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

    source_remaining_residual_amount
        NUMERIC(20, 2)
        NOT NULL,

    item_count
        INTEGER
        NOT NULL,

    rollover_status
        VARCHAR(30)
        NOT NULL,

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

    CONSTRAINT fk_continuation_rollover_snapshot_case
        FOREIGN KEY (
            rollover_case_id
        )
        REFERENCES procurement_remediation_continuation_rollover_cases (id),

    CONSTRAINT fk_continuation_rollover_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_continuation_rollover_snapshot_amount
        CHECK (
            source_remaining_residual_amount > 0
        ),

    CONSTRAINT ck_continuation_rollover_snapshot_count
        CHECK (
            item_count > 0
        ),

    CONSTRAINT ck_continuation_rollover_snapshot_status
        CHECK (
            rollover_status IN (
                'DRAFT',
                'IN_REVIEW',
                'APPROVED',
                'CLOSED'
            )
        )
);


CREATE TABLE procurement_remediation_continuation_rollover_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    rollover_item_id
        UUID
        NOT NULL,

    source_continuation_outcome_item_id
        UUID
        NOT NULL,

    source_continuation_item_id
        UUID
        NOT NULL,

    source_continuation_action
        VARCHAR(50)
        NOT NULL,

    source_resolution_type
        VARCHAR(50)
        NOT NULL,

    source_remaining_residual_amount
        NUMERIC(20, 2)
        NOT NULL,

    continuation_action
        VARCHAR(50)
        NOT NULL,

    target_date
        DATE
        NOT NULL,

    rationale
        VARCHAR(2500)
        NOT NULL,

    CONSTRAINT fk_continuation_rollover_snapshot_item_header
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_remediation_continuation_rollover_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_continuation_rollover_snapshot_item
        UNIQUE (
            snapshot_id,
            rollover_item_id
        )
);


CREATE INDEX idx_continuation_rollover_snapshot_case
    ON procurement_remediation_continuation_rollover_snapshots (
        rollover_case_id,
        captured_at DESC
    );


/*
 * ---------------------------------------------------------------------------
 * CASE INSERT AUTHORITY
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fcr89_validate_case_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    authoritative_status VARCHAR(30);
    authoritative_disposition VARCHAR(50);
    authoritative_verified_residual NUMERIC(20, 2);
    authoritative_outcome_number VARCHAR(80);
    authoritative_parent_case_id UUID;
    authoritative_parent_number VARCHAR(80);
    authoritative_title VARCHAR(240);
    authoritative_currency VARCHAR(3);
    authoritative_year INTEGER;

    actual_positive_count INTEGER;
    actual_positive_residual NUMERIC(20, 2);
BEGIN
    IF
        NEW.status <> 'DRAFT'

        OR

        NEW.version <> 0
    THEN
        RAISE EXCEPTION
            'Continuation rollover must be created as DRAFT version zero';
    END IF;


    IF
        NEW.review_submitted_by_user_id IS NOT NULL

        OR

        NEW.review_submitted_at IS NOT NULL

        OR

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
            'Continuation rollover lifecycle evidence cannot be pre-populated';
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
        authoritative_status,
        authoritative_disposition,
        authoritative_verified_residual,
        authoritative_outcome_number,
        authoritative_parent_case_id,
        authoritative_parent_number,
        authoritative_title,
        authoritative_currency,
        authoritative_year

    FROM procurement_remediation_continuation_outcome_cases outcome

    WHERE outcome.id =
        NEW.source_continuation_outcome_case_id

    FOR SHARE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source continuation outcome does not exist';
    END IF;


    IF
        authoritative_status <> 'VERIFIED'

        OR

        authoritative_disposition <> 'FURTHER_GOVERNANCE_REQUIRED'

        OR

        authoritative_verified_residual IS NULL

        OR

        authoritative_verified_residual <= 0
    THEN
        RAISE EXCEPTION
            'Continuation rollover requires VERIFIED positive residual requiring further governance';
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
        actual_positive_count,
        actual_positive_residual

    FROM procurement_remediation_continuation_outcome_items item

    WHERE item.outcome_case_id =
        NEW.source_continuation_outcome_case_id

    AND item.remaining_residual_amount > 0;


    IF
        actual_positive_count <= 0

        OR

        actual_positive_residual
            IS DISTINCT FROM authoritative_verified_residual
    THEN
        RAISE EXCEPTION
            'Verified continuation outcome residual does not reconcile to positive source items';
    END IF;


    IF
        NEW.source_continuation_outcome_number
            IS DISTINCT FROM authoritative_outcome_number

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
            IS DISTINCT FROM authoritative_verified_residual

        OR

        NEW.source_residual_item_count
            IS DISTINCT FROM actual_positive_count
    THEN
        RAISE EXCEPTION
            'Continuation rollover source authority does not reconcile';
    END IF;


    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_fcr89_validate_case_insert

BEFORE INSERT

ON procurement_remediation_continuation_rollover_cases

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fcr89_validate_case_insert();


/*
 * ---------------------------------------------------------------------------
 * ITEM INSERT AUTHORITY
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


    /*
     * The action is intentionally preserved.
     *
     * Step 89 does not silently transform one governance strategy into another.
     */
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


CREATE TRIGGER trg_fcr89_validate_item_insert

BEFORE INSERT

ON procurement_remediation_continuation_rollover_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fcr89_validate_item_insert();


/*
 * ---------------------------------------------------------------------------
 * ITEM IMMUTABILITY
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fcr89_protect_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Continuation rollover items are immutable';
END;
$$;


CREATE TRIGGER trg_fcr89_protect_item

BEFORE UPDATE OR DELETE

ON procurement_remediation_continuation_rollover_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fcr89_protect_item();


/*
 * ---------------------------------------------------------------------------
 * COMPLETE POSITIVE-RESIDUAL COVERAGE
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fcr89_validate_complete(
    requested_case_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    source_outcome_case_id UUID;

    expected_count INTEGER;
    expected_amount NUMERIC(20, 2);

    actual_count INTEGER;
    actual_amount NUMERIC(20, 2);
BEGIN
    SELECT
        source_continuation_outcome_case_id

    INTO
        source_outcome_case_id

    FROM procurement_remediation_continuation_rollover_cases

    WHERE id =
        requested_case_id;


    IF source_outcome_case_id IS NULL THEN
        RAISE EXCEPTION
            'Continuation rollover case does not exist';
    END IF;


    SELECT
        COUNT(*),
        COALESCE(
            SUM(
                remaining_residual_amount
            ),
            0
        )

    INTO
        expected_count,
        expected_amount

    FROM procurement_remediation_continuation_outcome_items

    WHERE outcome_case_id =
        source_outcome_case_id

    AND remaining_residual_amount > 0;


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

    FROM procurement_remediation_continuation_rollover_items

    WHERE rollover_case_id =
        requested_case_id;


    IF
        expected_count <> actual_count

        OR

        expected_amount <> actual_amount
    THEN
        RAISE EXCEPTION
            'Every positive residual outcome item requires rollover governance';
    END IF;
END;
$$;


/*
 * ---------------------------------------------------------------------------
 * CASE LIFECYCLE
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


    IF
        OLD.status = 'DRAFT'

        AND

        NEW.status = 'IN_REVIEW'
    THEN
        PERFORM
            procureiq_fcr89_validate_complete(
                OLD.id
            );


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


    IF
        OLD.status = 'IN_REVIEW'

        AND

        NEW.status = 'APPROVED'
    THEN
        PERFORM
            procureiq_fcr89_validate_complete(
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


    IF
        OLD.status = 'APPROVED'

        AND

        NEW.status = 'CLOSED'
    THEN
        PERFORM
            procureiq_fcr89_validate_complete(
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


CREATE TRIGGER trg_fcr89_protect_case_update

BEFORE UPDATE

ON procurement_remediation_continuation_rollover_cases

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fcr89_protect_case_update();


CREATE OR REPLACE FUNCTION procureiq_fcr89_protect_case_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Continuation rollover cases cannot be deleted';
END;
$$;


CREATE TRIGGER trg_fcr89_protect_case_delete

BEFORE DELETE

ON procurement_remediation_continuation_rollover_cases

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fcr89_protect_case_delete();


/*
 * ---------------------------------------------------------------------------
 * SNAPSHOT HEADER INSERT
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


CREATE TRIGGER trg_fcr89_snapshot_insert_guard

BEFORE INSERT

ON procurement_remediation_continuation_rollover_snapshots

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fcr89_snapshot_insert_guard();


/*
 * ---------------------------------------------------------------------------
 * SNAPSHOT ITEM AUTHORITY
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fcr89_snapshot_item_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    snapshot_sealed BOOLEAN;
    snapshot_case_id UUID;

    authoritative_case_id UUID;
    authoritative_outcome_item_id UUID;
    authoritative_continuation_item_id UUID;
    authoritative_source_action VARCHAR(50);
    authoritative_resolution VARCHAR(50);
    authoritative_amount NUMERIC(20, 2);
    authoritative_action VARCHAR(50);
    authoritative_target_date DATE;
    authoritative_rationale VARCHAR(2500);
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION
            'Continuation rollover snapshot items are immutable';
    END IF;


    SELECT
        sealed,
        rollover_case_id

    INTO
        snapshot_sealed,
        snapshot_case_id

    FROM procurement_remediation_continuation_rollover_snapshots

    WHERE id =
        NEW.snapshot_id

    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Continuation rollover snapshot does not exist';
    END IF;


    IF snapshot_sealed THEN
        RAISE EXCEPTION
            'Cannot append to sealed continuation rollover snapshot';
    END IF;


    SELECT
        item.rollover_case_id,
        item.source_continuation_outcome_item_id,
        item.source_continuation_item_id,
        item.source_continuation_action,
        item.source_resolution_type,
        item.source_remaining_residual_amount,
        item.continuation_action,
        item.target_date,
        item.rationale

    INTO
        authoritative_case_id,
        authoritative_outcome_item_id,
        authoritative_continuation_item_id,
        authoritative_source_action,
        authoritative_resolution,
        authoritative_amount,
        authoritative_action,
        authoritative_target_date,
        authoritative_rationale

    FROM procurement_remediation_continuation_rollover_items item

    WHERE item.id =
        NEW.rollover_item_id

    FOR SHARE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Authoritative continuation rollover item does not exist';
    END IF;


    IF authoritative_case_id <> snapshot_case_id THEN
        RAISE EXCEPTION
            'Snapshot rollover item belongs to another rollover case';
    END IF;


    IF
        NEW.source_continuation_outcome_item_id
            IS DISTINCT FROM authoritative_outcome_item_id

        OR

        NEW.source_continuation_item_id
            IS DISTINCT FROM authoritative_continuation_item_id

        OR

        NEW.source_continuation_action
            IS DISTINCT FROM authoritative_source_action

        OR

        NEW.source_resolution_type
            IS DISTINCT FROM authoritative_resolution

        OR

        NEW.source_remaining_residual_amount
            IS DISTINCT FROM authoritative_amount

        OR

        NEW.continuation_action
            IS DISTINCT FROM authoritative_action

        OR

        NEW.target_date
            IS DISTINCT FROM authoritative_target_date

        OR

        NEW.rationale
            IS DISTINCT FROM authoritative_rationale
    THEN
        RAISE EXCEPTION
            'Continuation rollover snapshot item does not match authority';
    END IF;


    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_fcr89_snapshot_item_guard

BEFORE INSERT OR UPDATE OR DELETE

ON procurement_remediation_continuation_rollover_snapshot_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fcr89_snapshot_item_guard();


/*
 * ---------------------------------------------------------------------------
 * SNAPSHOT SEALING
 * ---------------------------------------------------------------------------
 */

CREATE OR REPLACE FUNCTION procureiq_fcr89_snapshot_header_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
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

        FROM procurement_remediation_continuation_rollover_snapshot_items

        WHERE snapshot_id =
            OLD.id;


        IF
            actual_count <> NEW.item_count

            OR

            actual_amount <> NEW.source_remaining_residual_amount
        THEN
            RAISE EXCEPTION
                'Continuation rollover snapshot does not reconcile';
        END IF;


        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Continuation rollover snapshots are immutable after creation';
END;
$$;


CREATE TRIGGER trg_fcr89_snapshot_header_guard

BEFORE UPDATE OR DELETE

ON procurement_remediation_continuation_rollover_snapshots

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fcr89_snapshot_header_guard();


/*
 * ---------------------------------------------------------------------------
 * AUDIT
 * ---------------------------------------------------------------------------
 */

CREATE TRIGGER trg_audit_continuation_rollover_cases

AFTER INSERT OR UPDATE OR DELETE

ON procurement_remediation_continuation_rollover_cases

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_capture_audit_event();


CREATE TRIGGER trg_audit_continuation_rollover_items

AFTER INSERT OR UPDATE OR DELETE

ON procurement_remediation_continuation_rollover_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_capture_audit_event();
