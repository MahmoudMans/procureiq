CREATE SEQUENCE procurement_residual_remediation_plan_number_seq
    START WITH 1
    INCREMENT BY 1;


CREATE SEQUENCE procurement_residual_remediation_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;


CREATE TABLE procurement_residual_remediation_plans (
    id UUID PRIMARY KEY,

    plan_number
        VARCHAR(80)
        NOT NULL
        UNIQUE,

    source_execution_case_id
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

    source_positive_item_count
        INTEGER
        NOT NULL,

    owner_user_id
        UUID
        NOT NULL,

    owner_name
        VARCHAR(240)
        NOT NULL,

    remediation_objective
        VARCHAR(2500)
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

    CONSTRAINT fk_residual_remediation_source_case
        FOREIGN KEY (
            source_execution_case_id
        )
        REFERENCES procurement_variance_execution_cases (id),

    CONSTRAINT fk_residual_remediation_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_residual_remediation_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_residual_remediation_reviewer
        FOREIGN KEY (
            review_submitted_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_residual_remediation_approver
        FOREIGN KEY (
            approved_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_residual_remediation_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_residual_remediation_source_case
        UNIQUE (
            source_execution_case_id
        ),

    CONSTRAINT ck_residual_remediation_status
        CHECK (
            status IN (
                'DRAFT',
                'IN_REVIEW',
                'APPROVED',
                'CLOSED'
            )
        ),

    CONSTRAINT ck_residual_remediation_source_amount
        CHECK (
            source_residual_amount > 0
        ),

    CONSTRAINT ck_residual_remediation_source_item_count
        CHECK (
            source_positive_item_count > 0
        )
);


CREATE TABLE procurement_residual_remediation_items (
    id UUID PRIMARY KEY,

    remediation_plan_id
        UUID
        NOT NULL,

    source_execution_item_id
        UUID
        NOT NULL,

    source_decision
        VARCHAR(30)
        NOT NULL,

    source_variance_amount
        NUMERIC(20, 2)
        NOT NULL,

    source_executed_amount
        NUMERIC(20, 2)
        NOT NULL,

    residual_amount
        NUMERIC(20, 2)
        NOT NULL,

    remediation_action
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

    CONSTRAINT fk_residual_remediation_item_plan
        FOREIGN KEY (
            remediation_plan_id
        )
        REFERENCES procurement_residual_remediation_plans (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_residual_remediation_source_item
        FOREIGN KEY (
            source_execution_item_id
        )
        REFERENCES procurement_variance_execution_items (id),

    CONSTRAINT fk_residual_remediation_item_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_residual_remediation_source_item
        UNIQUE (
            source_execution_item_id
        ),

    CONSTRAINT ck_residual_remediation_source_decision
        CHECK (
            source_decision IN (
                'RECOVER',
                'WRITE_OFF',
                'INVESTIGATE'
            )
        ),

    CONSTRAINT ck_residual_remediation_action
        CHECK (
            remediation_action IN (
                'RECOVERY_FOLLOW_UP',
                'WRITE_OFF_REVIEW',
                'INVESTIGATION_ESCALATION',
                'RESIDUAL_ACCEPTANCE_REVIEW'
            )
        ),

    CONSTRAINT ck_residual_remediation_item_amounts
        CHECK (
            source_variance_amount > 0

            AND

            source_executed_amount >= 0

            AND

            source_executed_amount
                <= source_variance_amount

            AND

            residual_amount > 0

            AND

            residual_amount =
                source_variance_amount
                - source_executed_amount
        )
);


CREATE INDEX idx_residual_remediation_plan_status
    ON procurement_residual_remediation_plans (
        status,
        created_at DESC
    );


CREATE INDEX idx_residual_remediation_source_case
    ON procurement_residual_remediation_plans (
        source_execution_case_id
    );


CREATE INDEX idx_residual_remediation_item_plan
    ON procurement_residual_remediation_items (
        remediation_plan_id
    );


CREATE TABLE procurement_residual_remediation_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number
        VARCHAR(80)
        NOT NULL
        UNIQUE,

    remediation_plan_id
        UUID
        NOT NULL,

    plan_number
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

    recovery_follow_up_amount
        NUMERIC(20, 2)
        NOT NULL,

    write_off_review_amount
        NUMERIC(20, 2)
        NOT NULL,

    investigation_escalation_amount
        NUMERIC(20, 2)
        NOT NULL,

    residual_acceptance_review_amount
        NUMERIC(20, 2)
        NOT NULL,

    item_count
        INTEGER
        NOT NULL,

    plan_status
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

    CONSTRAINT fk_residual_remediation_snapshot_plan
        FOREIGN KEY (
            remediation_plan_id
        )
        REFERENCES procurement_residual_remediation_plans (id),

    CONSTRAINT fk_residual_remediation_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_residual_remediation_snapshot_status
        CHECK (
            plan_status IN (
                'DRAFT',
                'IN_REVIEW',
                'APPROVED',
                'CLOSED'
            )
        ),

    CONSTRAINT ck_residual_remediation_snapshot_amount
        CHECK (
            source_residual_amount > 0

            AND

            recovery_follow_up_amount >= 0

            AND

            write_off_review_amount >= 0

            AND

            investigation_escalation_amount >= 0

            AND

            residual_acceptance_review_amount >= 0

            AND

            recovery_follow_up_amount
                + write_off_review_amount
                + investigation_escalation_amount
                + residual_acceptance_review_amount
                <= source_residual_amount
        )
);


CREATE TABLE procurement_residual_remediation_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    remediation_item_id
        UUID
        NOT NULL,

    source_execution_item_id
        UUID
        NOT NULL,

    source_decision
        VARCHAR(30)
        NOT NULL,

    source_variance_amount
        NUMERIC(20, 2)
        NOT NULL,

    source_executed_amount
        NUMERIC(20, 2)
        NOT NULL,

    residual_amount
        NUMERIC(20, 2)
        NOT NULL,

    remediation_action
        VARCHAR(50)
        NOT NULL,

    target_date
        DATE
        NOT NULL,

    rationale
        VARCHAR(2500)
        NOT NULL,

    CONSTRAINT fk_residual_remediation_snapshot_item_header
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_residual_remediation_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_residual_remediation_snapshot_item
        UNIQUE (
            snapshot_id,
            remediation_item_id
        )
);


CREATE INDEX idx_residual_remediation_snapshot_plan
    ON procurement_residual_remediation_snapshots (
        remediation_plan_id,
        captured_at DESC
    );


CREATE INDEX idx_residual_remediation_snapshot_item_header
    ON procurement_residual_remediation_snapshot_items (
        snapshot_id
    );


CREATE OR REPLACE FUNCTION procureiq_frr77_validate_plan_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    source_status VARCHAR(30);

    source_currency VARCHAR(3);

    source_year INTEGER;

    expected_count INTEGER;

    expected_residual NUMERIC(20, 2);
BEGIN
    SELECT
        status,
        currency,
        fiscal_year

    INTO
        source_status,
        source_currency,
        source_year

    FROM procurement_variance_execution_cases

    WHERE id =
        NEW.source_execution_case_id

    FOR SHARE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source variance execution case does not exist';
    END IF;


    IF source_status NOT IN (
        'VERIFIED',
        'CLOSED'
    ) THEN
        RAISE EXCEPTION
            'Residual remediation requires VERIFIED or CLOSED execution evidence';
    END IF;


    SELECT
        COUNT(*),

        COALESCE(
            SUM(
                source_variance_amount
                - executed_amount
            ),
            0
        )

    INTO
        expected_count,
        expected_residual

    FROM procurement_variance_execution_items

    WHERE execution_case_id =
        NEW.source_execution_case_id

    AND source_variance_amount
        - executed_amount
        > 0;


    IF expected_count <= 0 THEN
        RAISE EXCEPTION
            'Source execution case has no positive financial residual';
    END IF;


    IF
        NEW.source_positive_item_count
        <> expected_count

        OR

        NEW.source_residual_amount
        <> expected_residual
    THEN
        RAISE EXCEPTION
            'Residual remediation source authority does not reconcile';
    END IF;


    IF
        NEW.currency <> source_currency

        OR

        NEW.fiscal_year <> source_year
    THEN
        RAISE EXCEPTION
            'Residual remediation copied source metadata is inconsistent';
    END IF;


    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_frr77_validate_plan_insert

BEFORE INSERT

ON procurement_residual_remediation_plans

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_frr77_validate_plan_insert();


CREATE OR REPLACE FUNCTION procureiq_frr77_validate_item_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    plan_status VARCHAR(30);

    plan_source_case UUID;

    item_source_case UUID;

    authoritative_decision VARCHAR(30);

    authoritative_variance NUMERIC(20, 2);

    authoritative_executed NUMERIC(20, 2);
BEGIN
    SELECT
        status,
        source_execution_case_id

    INTO
        plan_status,
        plan_source_case

    FROM procurement_residual_remediation_plans

    WHERE id =
        NEW.remediation_plan_id

    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Residual remediation plan does not exist';
    END IF;


    IF plan_status <> 'DRAFT' THEN
        RAISE EXCEPTION
            'Residual remediation decisions can be created only while DRAFT';
    END IF;


    SELECT
        execution_case_id,
        source_decision,
        source_variance_amount,
        executed_amount

    INTO
        item_source_case,
        authoritative_decision,
        authoritative_variance,
        authoritative_executed

    FROM procurement_variance_execution_items

    WHERE id =
        NEW.source_execution_item_id

    FOR SHARE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Source variance execution item does not exist';
    END IF;


    IF item_source_case <> plan_source_case THEN
        RAISE EXCEPTION
            'Source execution item belongs to another execution case';
    END IF;


    IF
        authoritative_variance
        - authoritative_executed
        <= 0
    THEN
        RAISE EXCEPTION
            'Only positive financial residual can be remediated';
    END IF;


    IF
        NEW.source_decision
            <> authoritative_decision

        OR

        NEW.source_variance_amount
            <> authoritative_variance

        OR

        NEW.source_executed_amount
            <> authoritative_executed

        OR

        NEW.residual_amount
            <> authoritative_variance
               - authoritative_executed
    THEN
        RAISE EXCEPTION
            'Residual remediation item does not match source execution authority';
    END IF;


    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_frr77_validate_item_insert

BEFORE INSERT

ON procurement_residual_remediation_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_frr77_validate_item_insert();


CREATE OR REPLACE FUNCTION procureiq_frr77_protect_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Residual remediation decisions are immutable';
END;
$$;


CREATE TRIGGER trg_frr77_protect_item

BEFORE UPDATE OR DELETE

ON procurement_residual_remediation_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_frr77_protect_item();


CREATE OR REPLACE FUNCTION procureiq_frr77_validate_complete(
    requested_plan_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    source_case UUID;

    expected_count INTEGER;

    actual_count INTEGER;

    expected_residual NUMERIC(20, 2);

    actual_residual NUMERIC(20, 2);
BEGIN
    SELECT
        source_execution_case_id

    INTO
        source_case

    FROM procurement_residual_remediation_plans

    WHERE id =
        requested_plan_id;


    IF source_case IS NULL THEN
        RAISE EXCEPTION
            'Residual remediation plan does not exist';
    END IF;


    SELECT
        COUNT(*),

        COALESCE(
            SUM(
                source_variance_amount
                - executed_amount
            ),
            0
        )

    INTO
        expected_count,
        expected_residual

    FROM procurement_variance_execution_items

    WHERE execution_case_id =
        source_case

    AND source_variance_amount
        - executed_amount
        > 0;


    SELECT
        COUNT(*),

        COALESCE(
            SUM(
                residual_amount
            ),
            0
        )

    INTO
        actual_count,
        actual_residual

    FROM procurement_residual_remediation_items

    WHERE remediation_plan_id =
        requested_plan_id;


    IF
        expected_count <> actual_count

        OR

        expected_residual <> actual_residual
    THEN
        RAISE EXCEPTION
            'Every positive residual execution item requires one remediation decision';
    END IF;
END;
$$;


CREATE OR REPLACE FUNCTION procureiq_frr77_protect_plan_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF
        NEW.id IS DISTINCT FROM OLD.id

        OR

        NEW.plan_number
            IS DISTINCT FROM OLD.plan_number

        OR

        NEW.source_execution_case_id
            IS DISTINCT FROM OLD.source_execution_case_id

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

        NEW.source_positive_item_count
            IS DISTINCT FROM OLD.source_positive_item_count

        OR

        NEW.owner_user_id
            IS DISTINCT FROM OLD.owner_user_id

        OR

        NEW.owner_name
            IS DISTINCT FROM OLD.owner_name

        OR

        NEW.remediation_objective
            IS DISTINCT FROM OLD.remediation_objective

        OR

        NEW.created_by_user_id
            IS DISTINCT FROM OLD.created_by_user_id

        OR

        NEW.created_at
            IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION
            'Residual remediation source authority is immutable';
    END IF;


    IF NEW.version <> OLD.version + 1 THEN
        RAISE EXCEPTION
            'Residual remediation version must increment exactly once';
    END IF;


    IF
        OLD.status = 'DRAFT'

        AND

        NEW.status = 'IN_REVIEW'
    THEN
        PERFORM
            procureiq_frr77_validate_complete(
                OLD.id
            );

        IF
            NEW.review_submitted_by_user_id
                IS NULL

            OR

            NEW.review_submitted_at
                IS NULL
        THEN
            RAISE EXCEPTION
                'Review submission evidence is required';
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
                'Review submission cannot alter approval or closure evidence';
        END IF;


        RETURN NEW;
    END IF;


    IF
        OLD.status = 'IN_REVIEW'

        AND

        NEW.status = 'APPROVED'
    THEN
        PERFORM
            procureiq_frr77_validate_complete(
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
                'Approval cannot alter review-submission evidence';
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
                'Closure evidence is required';
        END IF;


        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Invalid residual remediation lifecycle transition: % -> %',
        OLD.status,
        NEW.status;
END;
$$;


CREATE TRIGGER trg_frr77_protect_plan_update

BEFORE UPDATE

ON procurement_residual_remediation_plans

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_frr77_protect_plan_update();


CREATE OR REPLACE FUNCTION procureiq_frr77_protect_plan_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Residual remediation plans cannot be deleted';
END;
$$;


CREATE TRIGGER trg_frr77_protect_plan_delete

BEFORE DELETE

ON procurement_residual_remediation_plans

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_frr77_protect_plan_delete();


CREATE OR REPLACE FUNCTION procureiq_frr77_snapshot_item_guard()
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

        FROM procurement_residual_remediation_snapshots

        WHERE id =
            NEW.snapshot_id

        FOR UPDATE;


        IF snapshot_is_sealed THEN
            RAISE EXCEPTION
                'Cannot append to a sealed residual remediation snapshot';
        END IF;


        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Residual remediation snapshot items are immutable';
END;
$$;


CREATE TRIGGER trg_frr77_snapshot_item_guard

BEFORE INSERT OR UPDATE OR DELETE

ON procurement_residual_remediation_snapshot_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_frr77_snapshot_item_guard();


CREATE OR REPLACE FUNCTION procureiq_frr77_snapshot_header_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    item_count_value INTEGER;

    recovery_value NUMERIC(20, 2);

    write_off_value NUMERIC(20, 2);

    investigation_value NUMERIC(20, 2);

    acceptance_value NUMERIC(20, 2);
BEGIN
    IF
        TG_OP = 'UPDATE'

        AND

        OLD.sealed = FALSE

        AND

        NEW.sealed = TRUE
    THEN
        SELECT
            COUNT(*),

            COALESCE(
                SUM(
                    residual_amount
                )
                FILTER (
                    WHERE remediation_action =
                        'RECOVERY_FOLLOW_UP'
                ),
                0
            ),

            COALESCE(
                SUM(
                    residual_amount
                )
                FILTER (
                    WHERE remediation_action =
                        'WRITE_OFF_REVIEW'
                ),
                0
            ),

            COALESCE(
                SUM(
                    residual_amount
                )
                FILTER (
                    WHERE remediation_action =
                        'INVESTIGATION_ESCALATION'
                ),
                0
            ),

            COALESCE(
                SUM(
                    residual_amount
                )
                FILTER (
                    WHERE remediation_action =
                        'RESIDUAL_ACCEPTANCE_REVIEW'
                ),
                0
            )

        INTO
            item_count_value,
            recovery_value,
            write_off_value,
            investigation_value,
            acceptance_value

        FROM procurement_residual_remediation_snapshot_items

        WHERE snapshot_id =
            OLD.id;


        IF
            NEW.item_count
                <> item_count_value

            OR

            NEW.recovery_follow_up_amount
                <> recovery_value

            OR

            NEW.write_off_review_amount
                <> write_off_value

            OR

            NEW.investigation_escalation_amount
                <> investigation_value

            OR

            NEW.residual_acceptance_review_amount
                <> acceptance_value
        THEN
            RAISE EXCEPTION
                'Residual remediation snapshot header does not reconcile to snapshot items';
        END IF;


        RETURN NEW;
    END IF;


    RAISE EXCEPTION
        'Residual remediation snapshots are immutable after creation';
END;
$$;


CREATE TRIGGER trg_frr77_snapshot_header_guard

BEFORE UPDATE OR DELETE

ON procurement_residual_remediation_snapshots

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_frr77_snapshot_header_guard();


CREATE TRIGGER trg_audit_residual_remediation_plans

AFTER INSERT OR UPDATE OR DELETE

ON procurement_residual_remediation_plans

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_capture_audit_event();


CREATE TRIGGER trg_audit_residual_remediation_items

AFTER INSERT OR UPDATE OR DELETE

ON procurement_residual_remediation_items

FOR EACH ROW

EXECUTE FUNCTION
    procureiq_capture_audit_event();
