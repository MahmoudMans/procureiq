CREATE SEQUENCE procurement_remediation_outcome_number_seq
    START WITH 1
    INCREMENT BY 1;


CREATE SEQUENCE procurement_remediation_outcome_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;


CREATE TABLE procurement_remediation_outcome_cases (
    id UUID PRIMARY KEY,

    outcome_number
        VARCHAR(80)
        NOT NULL
        UNIQUE,

    source_remediation_plan_id
        UUID
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

    CONSTRAINT fk_remediation_outcome_source_plan
        FOREIGN KEY (
            source_remediation_plan_id
        )
        REFERENCES procurement_residual_remediation_plans (id),

    CONSTRAINT fk_remediation_outcome_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_remediation_outcome_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_remediation_outcome_submitter
        FOREIGN KEY (
            review_submitted_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_remediation_outcome_verifier
        FOREIGN KEY (
            verified_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_remediation_outcome_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_remediation_outcome_source_plan
        UNIQUE (
            source_remediation_plan_id
        ),

    CONSTRAINT ck_remediation_outcome_status
        CHECK (
            status IN (
                'DRAFT',
                'IN_REVIEW',
                'VERIFIED',
                'CLOSED'
            )
        ),

    CONSTRAINT ck_remediation_outcome_source_amount
        CHECK (
            source_residual_amount > 0
        ),

    CONSTRAINT ck_remediation_outcome_source_item_count
        CHECK (
            source_item_count > 0
        )
);


CREATE TABLE procurement_remediation_outcome_items (
    id UUID PRIMARY KEY,

    outcome_case_id
        UUID
        NOT NULL,

    source_remediation_item_id
        UUID
        NOT NULL,

    source_action
        VARCHAR(50)
        NOT NULL,

    source_residual_amount
        NUMERIC(20, 2)
        NOT NULL,

    resolution_type
        VARCHAR(50)
        NOT NULL,

    resolved_amount
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

    CONSTRAINT fk_remediation_outcome_item_case
        FOREIGN KEY (
            outcome_case_id
        )
        REFERENCES procurement_remediation_outcome_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_remediation_outcome_source_item
        FOREIGN KEY (
            source_remediation_item_id
        )
        REFERENCES procurement_residual_remediation_items (id),

    CONSTRAINT fk_remediation_outcome_item_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_remediation_outcome_source_item
        UNIQUE (
            source_remediation_item_id
        ),

    CONSTRAINT ck_remediation_outcome_source_action
        CHECK (
            source_action IN (
                'RECOVERY_FOLLOW_UP',
                'WRITE_OFF_REVIEW',
                'INVESTIGATION_ESCALATION',
                'RESIDUAL_ACCEPTANCE_REVIEW'
            )
        ),

    CONSTRAINT ck_remediation_outcome_resolution_type
        CHECK (
            resolution_type IN (
                'RECOVERY_EVIDENCED',
                'WRITE_OFF_EVIDENCED',
                'INVESTIGATION_RESOLVED',
                'RISK_ACCEPTANCE_EVIDENCED',
                'UNRESOLVED'
            )
        ),

    CONSTRAINT ck_remediation_outcome_amounts
        CHECK (
            source_residual_amount > 0

            AND

            resolved_amount >= 0

            AND

            resolved_amount <= source_residual_amount

            AND

            remaining_residual_amount =
                source_residual_amount
                - resolved_amount
        ),

    CONSTRAINT ck_remediation_outcome_resolution_amount
        CHECK (
            (
                resolution_type = 'UNRESOLVED'

                AND

                resolved_amount = 0
            )

            OR

            (
                resolution_type <> 'UNRESOLVED'

                AND

                resolved_amount > 0
            )
        ),

    CONSTRAINT ck_remediation_outcome_action_resolution
        CHECK (
            (
                source_action = 'RECOVERY_FOLLOW_UP'
                AND
                resolution_type IN (
                    'RECOVERY_EVIDENCED',
                    'UNRESOLVED'
                )
            )

            OR

            (
                source_action = 'WRITE_OFF_REVIEW'
                AND
                resolution_type IN (
                    'WRITE_OFF_EVIDENCED',
                    'UNRESOLVED'
                )
            )

            OR

            (
                source_action = 'INVESTIGATION_ESCALATION'
                AND
                resolution_type IN (
                    'INVESTIGATION_RESOLVED',
                    'UNRESOLVED'
                )
            )

            OR

            (
                source_action = 'RESIDUAL_ACCEPTANCE_REVIEW'
                AND
                resolution_type IN (
                    'RISK_ACCEPTANCE_EVIDENCED',
                    'UNRESOLVED'
                )
            )
        )
);


CREATE INDEX idx_remediation_outcome_case_status
    ON procurement_remediation_outcome_cases (
        status,
        created_at DESC
    );


CREATE INDEX idx_remediation_outcome_case_source
    ON procurement_remediation_outcome_cases (
        source_remediation_plan_id
    );


CREATE INDEX idx_remediation_outcome_item_case
    ON procurement_remediation_outcome_items (
        outcome_case_id
    );


CREATE TABLE procurement_remediation_outcome_snapshots (
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

    resolved_amount
        NUMERIC(20, 2)
        NOT NULL,

    remaining_residual_amount
        NUMERIC(20, 2)
        NOT NULL,

    item_count
        INTEGER
        NOT NULL,

    unresolved_item_count
        INTEGER
        NOT NULL,

    outcome_status
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

    CONSTRAINT fk_remediation_outcome_snapshot_case
        FOREIGN KEY (
            outcome_case_id
        )
        REFERENCES procurement_remediation_outcome_cases (id),

    CONSTRAINT fk_remediation_outcome_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_remediation_outcome_snapshot_amounts
        CHECK (
            source_residual_amount > 0

            AND

            resolved_amount >= 0

            AND

            remaining_residual_amount >= 0

            AND

            resolved_amount
                + remaining_residual_amount
                =
                source_residual_amount
        ),

    CONSTRAINT ck_remediation_outcome_snapshot_counts
        CHECK (
            item_count >= 0

            AND

            unresolved_item_count >= 0

            AND

            unresolved_item_count <= item_count
        ),

    CONSTRAINT ck_remediation_outcome_snapshot_status
        CHECK (
            outcome_status IN (
                'DRAFT',
                'IN_REVIEW',
                'VERIFIED',
                'CLOSED'
            )
        )
);


CREATE TABLE procurement_remediation_outcome_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    outcome_item_id
        UUID
        NOT NULL,

    source_remediation_item_id
        UUID
        NOT NULL,

    source_action
        VARCHAR(50)
        NOT NULL,

    source_residual_amount
        NUMERIC(20, 2)
        NOT NULL,

    resolution_type
        VARCHAR(50)
        NOT NULL,

    resolved_amount
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

    CONSTRAINT fk_remediation_outcome_snapshot_item_header
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_remediation_outcome_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_remediation_outcome_snapshot_item
        UNIQUE (
            snapshot_id,
            outcome_item_id
        )
);


CREATE INDEX idx_remediation_outcome_snapshot_case
    ON procurement_remediation_outcome_snapshots (
        outcome_case_id,
        captured_at DESC
    );


CREATE INDEX idx_remediation_outcome_snapshot_item_header
    ON procurement_remediation_outcome_snapshot_items (
        snapshot_id
    );


CREATE OR REPLACE FUNCTION procureiq_fro78_validate_case_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    source_status VARCHAR(30);

    source_currency VARCHAR(3);

    source_year INTEGER;

    source_amount NUMERIC(20, 2);

    expected_count INTEGER;

    expected_amount NUMERIC(20, 2);
BEGIN
    SELECT
        status,
        currency,
        fiscal_year,
        source_residual_amount

    INTO
        source_status,
        source_currency,
        source_year,
        source_amount

    FROM procurement_residual_remediation_plans

    WHERE id =
        NEW.source_remediation_plan_id

    FOR SHARE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source remediation plan does not exist';
    END IF;


    IF source_status NOT IN (
        'APPROVED',
        'CLOSED'
    ) THEN
        RAISE EXCEPTION
            'Outcome assurance requires APPROVED or CLOSED remediation governance';
    END IF;


    SELECT
        COUNT(*),
        COALESCE(
            SUM(
                residual_amount
            ),
            0
        )

    INTO
        expected_count,
        expected_amount

    FROM procurement_residual_remediation_items

    WHERE remediation_plan_id =
        NEW.source_remediation_plan_id;


    IF expected_count <= 0 THEN
        RAISE EXCEPTION
            'Source remediation plan has no governed residual items';
    END IF;


    IF
        NEW.source_item_count <> expected_count

        OR

        NEW.source_residual_amount <> expected_amount

        OR

        NEW.source_residual_amount <> source_amount
    THEN
        RAISE EXCEPTION
            'Outcome source authority does not reconcile';
    END IF;


    IF
        NEW.currency <> source_currency

        OR

        NEW.fiscal_year <> source_year
    THEN
        RAISE EXCEPTION
            'Outcome copied source metadata is inconsistent';
    END IF;


    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_fro78_validate_case_insert

BEFORE INSERT

ON procurement_remediation_outcome_cases

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fro78_validate_case_insert();


CREATE OR REPLACE FUNCTION procureiq_fro78_validate_item_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    case_status VARCHAR(30);

    source_plan_id UUID;

    authoritative_plan_id UUID;

    authoritative_action VARCHAR(50);

    authoritative_amount NUMERIC(20, 2);
BEGIN
    SELECT
        status,
        source_remediation_plan_id

    INTO
        case_status,
        source_plan_id

    FROM procurement_remediation_outcome_cases

    WHERE id =
        NEW.outcome_case_id

    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Remediation outcome case does not exist';
    END IF;


    IF case_status <> 'DRAFT' THEN
        RAISE EXCEPTION
            'Outcome evidence can be recorded only while DRAFT';
    END IF;


    SELECT
        remediation_plan_id,
        remediation_action,
        residual_amount

    INTO
        authoritative_plan_id,
        authoritative_action,
        authoritative_amount

    FROM procurement_residual_remediation_items

    WHERE id =
        NEW.source_remediation_item_id

    FOR SHARE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source remediation item does not exist';
    END IF;


    IF authoritative_plan_id <> source_plan_id THEN
        RAISE EXCEPTION
            'Source remediation item belongs to another remediation plan';
    END IF;


    IF
        NEW.source_action <> authoritative_action

        OR

        NEW.source_residual_amount <> authoritative_amount

        OR

        NEW.remaining_residual_amount
            <>
            authoritative_amount
            - NEW.resolved_amount
    THEN
        RAISE EXCEPTION
            'Outcome evidence does not match remediation authority';
    END IF;


    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_fro78_validate_item_insert

BEFORE INSERT

ON procurement_remediation_outcome_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fro78_validate_item_insert();


CREATE OR REPLACE FUNCTION procureiq_fro78_protect_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Remediation outcome evidence is immutable';
END;
$$;


CREATE TRIGGER trg_fro78_protect_item

BEFORE UPDATE OR DELETE

ON procurement_remediation_outcome_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fro78_protect_item();


CREATE OR REPLACE FUNCTION procureiq_fro78_validate_complete(
    requested_case_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    source_plan_id UUID;

    expected_count INTEGER;

    actual_count INTEGER;

    expected_amount NUMERIC(20, 2);

    actual_amount NUMERIC(20, 2);
BEGIN
    SELECT
        source_remediation_plan_id

    INTO
        source_plan_id

    FROM procurement_remediation_outcome_cases

    WHERE id =
        requested_case_id;


    IF source_plan_id IS NULL THEN
        RAISE EXCEPTION
            'Remediation outcome case does not exist';
    END IF;


    SELECT
        COUNT(*),
        COALESCE(
            SUM(
                residual_amount
            ),
            0
        )

    INTO
        expected_count,
        expected_amount

    FROM procurement_residual_remediation_items

    WHERE remediation_plan_id =
        source_plan_id;


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

    FROM procurement_remediation_outcome_items

    WHERE outcome_case_id =
        requested_case_id;


    IF
        expected_count <> actual_count

        OR

        expected_amount <> actual_amount
    THEN
        RAISE EXCEPTION
            'Every remediation decision requires one outcome evidence record';
    END IF;
END;
$$;


CREATE OR REPLACE FUNCTION procureiq_fro78_remaining_residual(
    requested_case_id UUID
)
RETURNS NUMERIC(20, 2)
LANGUAGE sql
STABLE
AS $$
    SELECT
        COALESCE(
            SUM(
                remaining_residual_amount
            ),
            0
        )

    FROM procurement_remediation_outcome_items

    WHERE outcome_case_id =
        requested_case_id;
$$;


CREATE OR REPLACE FUNCTION procureiq_fro78_protect_case_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
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


    IF
        OLD.status = 'IN_REVIEW'

        AND

        NEW.status = 'VERIFIED'
    THEN
        PERFORM
            procureiq_fro78_validate_complete(
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


        RETURN NEW;
    END IF;


    IF
        OLD.status = 'VERIFIED'

        AND

        NEW.status = 'CLOSED'
    THEN
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


CREATE TRIGGER trg_fro78_protect_case_update

BEFORE UPDATE

ON procurement_remediation_outcome_cases

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fro78_protect_case_update();


CREATE OR REPLACE FUNCTION procureiq_fro78_protect_case_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Remediation outcome cases cannot be deleted';
END;
$$;


CREATE TRIGGER trg_fro78_protect_case_delete

BEFORE DELETE

ON procurement_remediation_outcome_cases

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fro78_protect_case_delete();


CREATE OR REPLACE FUNCTION procureiq_fro78_snapshot_item_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    snapshot_is_sealed BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT
            sealed

        INTO
            snapshot_is_sealed

        FROM procurement_remediation_outcome_snapshots

        WHERE id =
            NEW.snapshot_id

        FOR UPDATE;


        IF snapshot_is_sealed THEN
            RAISE EXCEPTION
                'Cannot append to a sealed remediation outcome snapshot';
        END IF;


        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Remediation outcome snapshot items are immutable';
END;
$$;


CREATE TRIGGER trg_fro78_snapshot_item_guard

BEFORE INSERT OR UPDATE OR DELETE

ON procurement_remediation_outcome_snapshot_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fro78_snapshot_item_guard();


CREATE OR REPLACE FUNCTION procureiq_fro78_snapshot_header_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    actual_count INTEGER;

    unresolved_count INTEGER;

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
        IF
            NEW.id IS DISTINCT FROM OLD.id

            OR

            NEW.snapshot_number
                IS DISTINCT FROM OLD.snapshot_number

            OR

            NEW.outcome_case_id
                IS DISTINCT FROM OLD.outcome_case_id

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
            COUNT(*),

            COUNT(*)
            FILTER (
                WHERE remaining_residual_amount > 0
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
            unresolved_count,
            actual_resolved,
            actual_remaining

        FROM procurement_remediation_outcome_snapshot_items

        WHERE snapshot_id =
            OLD.id;


        IF
            actual_count <> NEW.item_count

            OR

            unresolved_count <> NEW.unresolved_item_count

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


CREATE TRIGGER trg_fro78_snapshot_header_guard

BEFORE UPDATE OR DELETE

ON procurement_remediation_outcome_snapshots

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_fro78_snapshot_header_guard();


CREATE TRIGGER trg_audit_remediation_outcome_cases

AFTER INSERT OR UPDATE OR DELETE

ON procurement_remediation_outcome_cases

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_capture_audit_event();


CREATE TRIGGER trg_audit_remediation_outcome_items

AFTER INSERT OR UPDATE OR DELETE

ON procurement_remediation_outcome_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_capture_audit_event();
