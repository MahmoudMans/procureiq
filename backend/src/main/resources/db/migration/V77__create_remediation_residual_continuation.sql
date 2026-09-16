CREATE SEQUENCE procurement_remediation_continuation_number_seq
    START WITH 1
    INCREMENT BY 1;


CREATE SEQUENCE procurement_remediation_continuation_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;


CREATE TABLE procurement_remediation_continuation_cases (
    id UUID PRIMARY KEY,

    continuation_number
        VARCHAR(80)
        NOT NULL
        UNIQUE,

    source_outcome_case_id
        UUID
        NOT NULL,

    source_outcome_number
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

    CONSTRAINT fk_remediation_continuation_source_case
        FOREIGN KEY (
            source_outcome_case_id
        )
        REFERENCES procurement_remediation_outcome_cases (id),

    CONSTRAINT fk_remediation_continuation_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_remediation_continuation_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_remediation_continuation_submitter
        FOREIGN KEY (
            review_submitted_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_remediation_continuation_approver
        FOREIGN KEY (
            approved_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_remediation_continuation_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_remediation_continuation_source_case
        UNIQUE (
            source_outcome_case_id
        ),

    CONSTRAINT ck_remediation_continuation_status
        CHECK (
            status IN (
                'DRAFT',
                'IN_REVIEW',
                'APPROVED',
                'CLOSED'
            )
        ),

    CONSTRAINT ck_remediation_continuation_residual
        CHECK (
            source_remaining_residual_amount > 0
        ),

    CONSTRAINT ck_remediation_continuation_item_count
        CHECK (
            source_residual_item_count > 0
        )
);


CREATE TABLE procurement_remediation_continuation_items (
    id UUID PRIMARY KEY,

    continuation_case_id
        UUID
        NOT NULL,

    source_outcome_item_id
        UUID
        NOT NULL,

    source_action
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

    CONSTRAINT fk_remediation_continuation_item_case
        FOREIGN KEY (
            continuation_case_id
        )
        REFERENCES procurement_remediation_continuation_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_remediation_continuation_source_item
        FOREIGN KEY (
            source_outcome_item_id
        )
        REFERENCES procurement_remediation_outcome_items (id),

    CONSTRAINT fk_remediation_continuation_item_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_remediation_continuation_source_item
        UNIQUE (
            source_outcome_item_id
        ),

    CONSTRAINT ck_remediation_continuation_source_amount
        CHECK (
            source_remaining_residual_amount > 0
        ),

    CONSTRAINT ck_remediation_continuation_action
        CHECK (
            continuation_action IN (
                'RECOVERY_RETRY',
                'WRITE_OFF_ESCALATION',
                'INVESTIGATION_ESCALATION',
                'RISK_ACCEPTANCE_ESCALATION'
            )
        )
);


CREATE INDEX idx_remediation_continuation_status
    ON procurement_remediation_continuation_cases (
        status,
        created_at DESC
    );


CREATE INDEX idx_remediation_continuation_source
    ON procurement_remediation_continuation_cases (
        source_outcome_case_id
    );


CREATE INDEX idx_remediation_continuation_item_case
    ON procurement_remediation_continuation_items (
        continuation_case_id
    );


CREATE TABLE procurement_remediation_continuation_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number
        VARCHAR(80)
        NOT NULL
        UNIQUE,

    continuation_case_id
        UUID
        NOT NULL,

    continuation_number
        VARCHAR(80)
        NOT NULL,

    source_outcome_case_id
        UUID
        NOT NULL,

    source_outcome_number
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

    continuation_status
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

    CONSTRAINT fk_remediation_continuation_snapshot_case
        FOREIGN KEY (
            continuation_case_id
        )
        REFERENCES procurement_remediation_continuation_cases (id),

    CONSTRAINT fk_remediation_continuation_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_remediation_continuation_snapshot_amount
        CHECK (
            source_remaining_residual_amount > 0
        ),

    CONSTRAINT ck_remediation_continuation_snapshot_count
        CHECK (
            item_count > 0
        ),

    CONSTRAINT ck_remediation_continuation_snapshot_status
        CHECK (
            continuation_status IN (
                'DRAFT',
                'IN_REVIEW',
                'APPROVED',
                'CLOSED'
            )
        )
);


CREATE TABLE procurement_remediation_continuation_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    continuation_item_id
        UUID
        NOT NULL,

    source_outcome_item_id
        UUID
        NOT NULL,

    source_action
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

    CONSTRAINT fk_remediation_continuation_snapshot_item
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_remediation_continuation_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_remediation_continuation_snapshot_item
        UNIQUE (
            snapshot_id,
            continuation_item_id
        )
);


CREATE INDEX idx_remediation_continuation_snapshot_case
    ON procurement_remediation_continuation_snapshots (
        continuation_case_id,
        captured_at DESC
    );


CREATE OR REPLACE FUNCTION procureiq_frc81_validate_case_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    source_status VARCHAR(30);

    authoritative_number VARCHAR(80);

    authoritative_currency VARCHAR(3);

    authoritative_year INTEGER;

    authoritative_amount NUMERIC(20, 2);

    authoritative_count INTEGER;
BEGIN
    SELECT
        outcome.status,
        outcome.outcome_number,
        outcome.currency,
        outcome.fiscal_year,

        COALESCE(
            SUM(
                item.remaining_residual_amount
            )
            FILTER (
                WHERE item.remaining_residual_amount > 0
            ),
            0
        ),

        COUNT(
            item.id
        )
        FILTER (
            WHERE item.remaining_residual_amount > 0
        )

    INTO
        source_status,
        authoritative_number,
        authoritative_currency,
        authoritative_year,
        authoritative_amount,
        authoritative_count

    FROM procurement_remediation_outcome_cases outcome

    LEFT JOIN procurement_remediation_outcome_items item
        ON item.outcome_case_id =
           outcome.id

    WHERE outcome.id =
        NEW.source_outcome_case_id

    GROUP BY
        outcome.id;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source remediation outcome case does not exist';
    END IF;


    IF source_status <> 'VERIFIED' THEN
        RAISE EXCEPTION
            'Residual continuation requires VERIFIED remediation outcome';
    END IF;


    IF
        authoritative_amount <= 0

        OR

        authoritative_count <= 0
    THEN
        RAISE EXCEPTION
            'Residual continuation requires positive remaining exposure';
    END IF;


    IF
        NEW.source_outcome_number
            IS DISTINCT FROM authoritative_number

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

        NEW.source_residual_item_count
            IS DISTINCT FROM authoritative_count
    THEN
        RAISE EXCEPTION
            'Residual continuation source authority does not reconcile';
    END IF;


    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_frc81_validate_case_insert

BEFORE INSERT

ON procurement_remediation_continuation_cases

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_frc81_validate_case_insert();


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


    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_frc81_validate_item_insert

BEFORE INSERT

ON procurement_remediation_continuation_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_frc81_validate_item_insert();


CREATE OR REPLACE FUNCTION procureiq_frc81_protect_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Residual continuation items are immutable';
END;
$$;


CREATE TRIGGER trg_frc81_protect_item

BEFORE UPDATE OR DELETE

ON procurement_remediation_continuation_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_frc81_protect_item();


CREATE OR REPLACE FUNCTION procureiq_frc81_validate_complete(
    requested_case_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    source_case_id UUID;

    expected_count INTEGER;

    actual_count INTEGER;

    expected_amount NUMERIC(20, 2);

    actual_amount NUMERIC(20, 2);
BEGIN
    SELECT
        source_outcome_case_id

    INTO
        source_case_id

    FROM procurement_remediation_continuation_cases

    WHERE id =
        requested_case_id;


    IF source_case_id IS NULL THEN
        RAISE EXCEPTION
            'Residual continuation case does not exist';
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

    FROM procurement_remediation_outcome_items

    WHERE outcome_case_id =
        source_case_id

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

    FROM procurement_remediation_continuation_items

    WHERE continuation_case_id =
        requested_case_id;


    IF
        expected_count <> actual_count

        OR

        expected_amount <> actual_amount
    THEN
        RAISE EXCEPTION
            'Every positive residual outcome item requires continuation governance';
    END IF;
END;
$$;


CREATE OR REPLACE FUNCTION procureiq_frc81_protect_case_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
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


    IF
        OLD.status = 'IN_REVIEW'

        AND

        NEW.status = 'APPROVED'
    THEN
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


        RETURN NEW;
    END IF;


    IF
        OLD.status = 'APPROVED'

        AND

        NEW.status = 'CLOSED'
    THEN
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
                'Closure cannot alter prior governance evidence';
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


CREATE TRIGGER trg_frc81_protect_case_update

BEFORE UPDATE

ON procurement_remediation_continuation_cases

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_frc81_protect_case_update();


CREATE OR REPLACE FUNCTION procureiq_frc81_protect_case_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Residual continuation cases cannot be deleted';
END;
$$;


CREATE TRIGGER trg_frc81_protect_case_delete

BEFORE DELETE

ON procurement_remediation_continuation_cases

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_frc81_protect_case_delete();


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
BEGIN
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


CREATE TRIGGER trg_frc81_snapshot_insert_guard

BEFORE INSERT

ON procurement_remediation_continuation_snapshots

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_frc81_snapshot_insert_guard();


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


CREATE TRIGGER trg_frc81_snapshot_item_guard

BEFORE INSERT OR UPDATE OR DELETE

ON procurement_remediation_continuation_snapshot_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_frc81_snapshot_item_guard();


CREATE OR REPLACE FUNCTION procureiq_frc81_snapshot_header_guard()
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
            actual_count <> NEW.item_count

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


CREATE TRIGGER trg_frc81_snapshot_header_guard

BEFORE UPDATE OR DELETE

ON procurement_remediation_continuation_snapshots

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_frc81_snapshot_header_guard();


CREATE TRIGGER trg_audit_remediation_continuation_cases

AFTER INSERT OR UPDATE OR DELETE

ON procurement_remediation_continuation_cases

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_capture_audit_event();


CREATE TRIGGER trg_audit_remediation_continuation_items

AFTER INSERT OR UPDATE OR DELETE

ON procurement_remediation_continuation_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_capture_audit_event();
