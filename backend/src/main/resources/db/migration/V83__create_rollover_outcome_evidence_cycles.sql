-- Rollover outcome evidence and repeatable follow-up cycles.
-- Historical rollover and outcome tables are never updated by this module.

CREATE TABLE procurement_rollover_evidence_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    root_rollover_id UUID NOT NULL
        REFERENCES procurement_remediation_continuation_rollover_cases(id),
    parent_id UUID REFERENCES procurement_rollover_evidence_cycles(id),
    source_snapshot_id UUID,
    cycle_no INTEGER NOT NULL CHECK (cycle_no > 0),
    title VARCHAR(240) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    fiscal_year INTEGER NOT NULL,
    opening_amount NUMERIC NOT NULL CHECK (
        opening_amount > 0
        AND opening_amount < 1000000000000000000
        AND opening_amount = trunc(opening_amount, 2)
    ),
    expected_items INTEGER NOT NULL CHECK (expected_items > 0),
    status VARCHAR(32) NOT NULL CHECK (
        status IN (
            'PLAN_DRAFT',
            'PLAN_REVIEW',
            'PLAN_APPROVED',
            'OBSERVING',
            'EVIDENCE_REVIEW',
            'VERIFIED',
            'CLOSED'
        )
    ),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_by UUID NOT NULL REFERENCES app_users(id),
    last_actor UUID NOT NULL REFERENCES app_users(id),
    last_event VARCHAR(40) NOT NULL,
    last_note VARCHAR(2500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(parent_id),
    UNIQUE(root_rollover_id, cycle_no),
    CHECK ((parent_id IS NULL) = (source_snapshot_id IS NULL))
);

CREATE UNIQUE INDEX uq_rce91_imported_root
    ON procurement_rollover_evidence_cycles(root_rollover_id)
    WHERE parent_id IS NULL;

CREATE INDEX ix_rce91_cycle_status
    ON procurement_rollover_evidence_cycles(status, created_at DESC);

CREATE TABLE procurement_rollover_evidence_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES procurement_rollover_evidence_cycles(id),
    source_rollover_item_id UUID NOT NULL
        REFERENCES procurement_remediation_continuation_rollover_items(id),
    parent_item_id UUID REFERENCES procurement_rollover_evidence_items(id),
    action VARCHAR(50) NOT NULL CHECK (
        action IN (
            'RECOVERY_RETRY',
            'WRITE_OFF_ESCALATION',
            'INVESTIGATION_ESCALATION',
            'RISK_ACCEPTANCE_ESCALATION'
        )
    ),
    opening_amount NUMERIC NOT NULL CHECK (
        opening_amount > 0 AND opening_amount = trunc(opening_amount, 2)
    ),
    UNIQUE(cycle_id, source_rollover_item_id),
    UNIQUE(parent_item_id)
);

CREATE INDEX ix_rce91_items_cycle
    ON procurement_rollover_evidence_items(cycle_id);

CREATE TABLE procurement_rollover_evidence_plans (
    item_id UUID PRIMARY KEY REFERENCES procurement_rollover_evidence_items(id),
    cycle_id UUID NOT NULL REFERENCES procurement_rollover_evidence_cycles(id),
    target_date DATE NOT NULL,
    rationale VARCHAR(2500) NOT NULL CHECK (btrim(rationale) <> ''),
    actor_id UUID NOT NULL REFERENCES app_users(id),
    recorded_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cycle_id, recorded_version)
);

CREATE TABLE procurement_rollover_evidence_observations (
    item_id UUID PRIMARY KEY REFERENCES procurement_rollover_evidence_items(id),
    cycle_id UUID NOT NULL REFERENCES procurement_rollover_evidence_cycles(id),
    resolution_type VARCHAR(50) NOT NULL CHECK (
        resolution_type IN (
            'RECOVERY_CONFIRMED',
            'WRITE_OFF_CONFIRMED',
            'INVESTIGATION_CONCLUDED',
            'RISK_ACCEPTANCE_CONFIRMED',
            'PARTIAL',
            'UNRESOLVED'
        )
    ),
    reduction_amount NUMERIC NOT NULL CHECK (
        reduction_amount >= 0
        AND reduction_amount = trunc(reduction_amount, 2)
    ),
    observed_on DATE NOT NULL,
    evidence_reference VARCHAR(500) NOT NULL CHECK (
        btrim(evidence_reference) <> ''
    ),
    evidence_note VARCHAR(2500) NOT NULL CHECK (btrim(evidence_note) <> ''),
    actor_id UUID NOT NULL REFERENCES app_users(id),
    recorded_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cycle_id, recorded_version)
);

CREATE TABLE procurement_rollover_evidence_events (
    cycle_id UUID NOT NULL REFERENCES procurement_rollover_evidence_cycles(id),
    version BIGINT NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    actor_id UUID NOT NULL REFERENCES app_users(id),
    actor_name VARCHAR(240) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    note VARCHAR(2500) NOT NULL,
    status VARCHAR(32) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(cycle_id, version)
);

CREATE TABLE procurement_rollover_evidence_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES procurement_rollover_evidence_cycles(id),
    captured_version BIGINT NOT NULL,
    captured_by UUID NOT NULL REFERENCES app_users(id),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    document JSONB NOT NULL,
    UNIQUE(cycle_id, captured_version)
);

ALTER TABLE procurement_rollover_evidence_cycles
    ADD CONSTRAINT fk_rce91_source_snapshot
    FOREIGN KEY (source_snapshot_id)
    REFERENCES procurement_rollover_evidence_snapshots(id);

CREATE FUNCTION procureiq_rce91_actor(p_actor UUID, p_level TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    a RECORD;
BEGIN
    IF p_level IS NULL OR p_level NOT IN ('READ','WRITE','MANAGER') THEN
        RAISE EXCEPTION USING
            ERRCODE='42501',
            MESSAGE='Unknown permission level.';
    END IF;

    SELECT full_name, role::TEXT AS role, active
    INTO a
    FROM app_users
    WHERE id = p_actor;

    IF NOT FOUND OR a.active IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION USING
            ERRCODE='42501',
            MESSAGE='An active user is required.';
    END IF;

    IF a.role NOT IN ('APPROVER','BUYER','PROCUREMENT_MANAGER','ADMIN')
       OR (
           p_level='WRITE'
           AND a.role NOT IN ('BUYER','PROCUREMENT_MANAGER','ADMIN')
       )
       OR (
           p_level='MANAGER'
           AND a.role NOT IN ('PROCUREMENT_MANAGER','ADMIN')
       )
    THEN
        RAISE EXCEPTION USING
            ERRCODE='42501',
            MESSAGE='Your role cannot perform this operation.';
    END IF;

    RETURN a.role;
END;
$$;

CREATE FUNCTION procureiq_rce91_metrics(p_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'opening', c.opening_amount::TEXT,
        'recovered', x.recovered::TEXT,
        'writeOff', x.write_off::TEXT,
        'otherReduction', x.other_reduction::TEXT,
        'reduction', x.reduction::TEXT,
        'remaining', (c.opening_amount-x.reduction)::TEXT,
        'reductionPercent',
            round(100*x.reduction/c.opening_amount,2)::TEXT,
        'itemCount', c.expected_items,
        'observedCount', x.observed_count,
        'complete', x.observed_count=c.expected_items,
        'disposition',
            CASE
                WHEN c.status NOT IN ('VERIFIED','CLOSED')
                    THEN 'PENDING_VERIFICATION'
                WHEN c.opening_amount=x.reduction
                    THEN 'FULLY_RESOLVED'
                ELSE 'FURTHER_GOVERNANCE_REQUIRED'
            END
    )
    FROM procurement_rollover_evidence_cycles c
    CROSS JOIN LATERAL (
        SELECT
            count(o.item_id) AS observed_count,
            coalesce(sum(o.reduction_amount),0) AS reduction,
            coalesce(
                sum(o.reduction_amount)
                FILTER (WHERE i.action='RECOVERY_RETRY'),
                0
            ) AS recovered,
            coalesce(
                sum(o.reduction_amount)
                FILTER (WHERE i.action='WRITE_OFF_ESCALATION'),
                0
            ) AS write_off,
            coalesce(
                sum(o.reduction_amount)
                FILTER (WHERE i.action='INVESTIGATION_ESCALATION'),
                0
            ) AS other_reduction
        FROM procurement_rollover_evidence_items i
        LEFT JOIN procurement_rollover_evidence_observations o
            ON o.item_id=i.id
        WHERE i.cycle_id=c.id
    ) x
    WHERE c.id=p_id;
$$;

CREATE FUNCTION procureiq_rce91_complete_baseline(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    c RECORD;
    n BIGINT;
    amount NUMERIC;
BEGIN
    SELECT *
    INTO c
    FROM procurement_rollover_evidence_cycles
    WHERE id=p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE='P0002',
            MESSAGE='Evidence cycle not found.';
    END IF;

    SELECT count(*), coalesce(sum(opening_amount),0)
    INTO n,amount
    FROM procurement_rollover_evidence_items
    WHERE cycle_id=p_id;

    IF n<>c.expected_items OR amount<>c.opening_amount THEN
        RAISE EXCEPTION USING
            ERRCODE='55000',
            MESSAGE='The complete source baseline is required.';
    END IF;
END;
$$;

CREATE FUNCTION procureiq_rce91_document(p_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'schemaVersion',1,
        'cycle',jsonb_build_object(
            'id',c.id,
            'rootRolloverId',c.root_rollover_id,
            'rootRolloverNumber',r.rollover_number,
            'parentCycleId',c.parent_id,
            'sourceSnapshotId',c.source_snapshot_id,
            'cycleNumber',c.cycle_no,
            'title',c.title,
            'currency',c.currency,
            'fiscalYear',c.fiscal_year,
            'status',c.status,
            'version',c.version,
            'createdAt',c.created_at
        ),
        'metrics',procureiq_rce91_metrics(c.id),
        'items',coalesce(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id',i.id,
                        'sourceRolloverItemId',i.source_rollover_item_id,
                        'parentItemId',i.parent_item_id,
                        'action',i.action,
                        'openingAmount',i.opening_amount::TEXT,
                        'plan',
                            CASE
                                WHEN p.item_id IS NULL THEN NULL
                                ELSE jsonb_build_object(
                                    'targetDate',p.target_date,
                                    'rationale',p.rationale
                                )
                            END,
                        'observation',
                            CASE
                                WHEN o.item_id IS NULL THEN NULL
                                ELSE jsonb_build_object(
                                    'resolutionType',o.resolution_type,
                                    'reductionAmount',o.reduction_amount::TEXT,
                                    'remainingAmount',
                                        (i.opening_amount-o.reduction_amount)::TEXT,
                                    'observedOn',o.observed_on,
                                    'evidenceReference',o.evidence_reference,
                                    'evidenceNote',o.evidence_note
                                )
                            END
                    )
                    ORDER BY i.id
                )
                FROM procurement_rollover_evidence_items i
                LEFT JOIN procurement_rollover_evidence_plans p
                    ON p.item_id=i.id
                LEFT JOIN procurement_rollover_evidence_observations o
                    ON o.item_id=i.id
                WHERE i.cycle_id=c.id
            ),
            '[]'::JSONB
        ),
        'events',coalesce(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'version',e.version,
                        'type',e.event_type,
                        'actorName',e.actor_name,
                        'actorRole',e.actor_role,
                        'note',e.note,
                        'at',e.occurred_at
                    )
                    ORDER BY e.version
                )
                FROM procurement_rollover_evidence_events e
                WHERE e.cycle_id=c.id
            ),
            '[]'::JSONB
        )
    )
    FROM procurement_rollover_evidence_cycles c
    JOIN procurement_remediation_continuation_rollover_cases r
        ON r.id=c.root_rollover_id
    WHERE c.id=p_id;
$$;

CREATE FUNCTION procureiq_rce91_cycle_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    src RECORD;
    s RECORD;
    n BIGINT;
    amount NUMERIC;
    m JSONB;
    allowed BOOLEAN:=FALSE;
BEGIN
    IF TG_OP='DELETE' THEN
        RAISE EXCEPTION 'Evidence cycles cannot be deleted.';
    END IF;

    IF TG_OP='INSERT' THEN
        PERFORM procureiq_rce91_actor(NEW.created_by,'WRITE');

        IF NEW.version<>0
           OR NEW.last_actor IS DISTINCT FROM NEW.created_by
           OR NEW.last_event<>'OPENED'
        THEN
            RAISE EXCEPTION 'Invalid initial evidence cycle state.';
        END IF;

        IF NEW.parent_id IS NULL THEN
            SELECT *
            INTO src
            FROM procurement_remediation_continuation_rollover_cases
            WHERE id=NEW.root_rollover_id
            FOR SHARE;

            IF NOT FOUND
               OR src.status IS DISTINCT FROM 'CLOSED'
               OR src.closed_at IS NULL
            THEN
                RAISE EXCEPTION USING
                    ERRCODE='55000',
                    MESSAGE='Only CLOSED rollovers can open outcome evidence.';
            END IF;

            SELECT
                count(*),
                coalesce(sum(source_remaining_residual_amount),0)
            INTO n,amount
            FROM procurement_remediation_continuation_rollover_items
            WHERE rollover_case_id=src.id;

            IF NEW.cycle_no<>1
               OR NEW.status<>'OBSERVING'
               OR NEW.source_snapshot_id IS NOT NULL
               OR NEW.title IS DISTINCT FROM src.title
               OR NEW.currency IS DISTINCT FROM src.currency
               OR NEW.fiscal_year IS DISTINCT FROM src.fiscal_year
               OR NEW.opening_amount IS DISTINCT FROM
                    src.source_remaining_residual_amount
               OR NEW.expected_items IS DISTINCT FROM
                    src.source_residual_item_count
               OR n<>NEW.expected_items
               OR amount<>NEW.opening_amount
            THEN
                RAISE EXCEPTION
                    'Imported rollover authority does not reconcile.';
            END IF;
        ELSE
            SELECT *
            INTO src
            FROM procurement_rollover_evidence_cycles
            WHERE id=NEW.parent_id
            FOR UPDATE;

            IF NOT FOUND OR src.status IS DISTINCT FROM 'VERIFIED' THEN
                RAISE EXCEPTION USING
                    ERRCODE='55000',
                    MESSAGE='The parent cycle must be VERIFIED.';
            END IF;

            m:=procureiq_rce91_metrics(src.id);

            SELECT *
            INTO s
            FROM procurement_rollover_evidence_snapshots
            WHERE id=NEW.source_snapshot_id;

            IF NOT FOUND
               OR s.cycle_id IS DISTINCT FROM src.id
               OR s.captured_version<>src.version
               OR s.document#>>'{cycle,status}'
                    IS DISTINCT FROM 'VERIFIED'
            THEN
                RAISE EXCEPTION
                    'A sealed verified parent snapshot is required.';
            END IF;

            SELECT
                count(*),
                coalesce(sum(i.opening_amount-o.reduction_amount),0)
            INTO n,amount
            FROM procurement_rollover_evidence_items i
            JOIN procurement_rollover_evidence_observations o
                ON o.item_id=i.id
            WHERE i.cycle_id=src.id
              AND i.opening_amount>o.reduction_amount;

            IF m->>'disposition'
                    IS DISTINCT FROM 'FURTHER_GOVERNANCE_REQUIRED'
               OR amount<=0
               OR NEW.root_rollover_id IS DISTINCT FROM src.root_rollover_id
               OR NEW.cycle_no<>src.cycle_no+1
               OR NEW.status<>'PLAN_DRAFT'
               OR NEW.title IS DISTINCT FROM src.title
               OR NEW.currency IS DISTINCT FROM src.currency
               OR NEW.fiscal_year IS DISTINCT FROM src.fiscal_year
               OR NEW.opening_amount<>amount
               OR NEW.expected_items<>n
            THEN
                RAISE EXCEPTION USING
                    ERRCODE='55000',
                    MESSAGE='Only verified positive residual can start the next governed cycle.';
            END IF;
        END IF;

        NEW.created_at:=CURRENT_TIMESTAMP;
        NEW.updated_at:=CURRENT_TIMESTAMP;
        RETURN NEW;
    END IF;

    IF (
        to_jsonb(NEW)
        -ARRAY['status','version','last_actor','last_event','last_note','updated_at']
    ) IS DISTINCT FROM (
        to_jsonb(OLD)
        -ARRAY['status','version','last_actor','last_event','last_note','updated_at']
    ) THEN
        RAISE EXCEPTION
            'Cycle lineage and opening authority are immutable.';
    END IF;

    IF NEW.version<>OLD.version+1 OR btrim(NEW.last_note)='' THEN
        RAISE EXCEPTION
            'An exact version increment and operation note are required.';
    END IF;

    PERFORM procureiq_rce91_complete_baseline(OLD.id);

    PERFORM procureiq_rce91_actor(
        NEW.last_actor,
        CASE
            WHEN NEW.last_event IN (
                'GOVERNANCE_APPROVED',
                'GOVERNANCE_CLOSED',
                'EVIDENCE_VERIFIED',
                'EVIDENCE_CLOSED'
            ) THEN 'MANAGER'
            ELSE 'WRITE'
        END
    );

    IF NEW.last_event='PLAN_RECORDED' THEN
        allowed:=
            OLD.status='PLAN_DRAFT'
            AND NEW.status=OLD.status
            AND EXISTS(
                SELECT 1
                FROM procurement_rollover_evidence_plans
                WHERE cycle_id=OLD.id
                  AND recorded_version=NEW.version
                  AND actor_id=NEW.last_actor
            );
    ELSIF NEW.last_event='OBSERVATION_RECORDED' THEN
        allowed:=
            OLD.status='OBSERVING'
            AND NEW.status=OLD.status
            AND EXISTS(
                SELECT 1
                FROM procurement_rollover_evidence_observations
                WHERE cycle_id=OLD.id
                  AND recorded_version=NEW.version
                  AND actor_id=NEW.last_actor
            );
    ELSIF NEW.last_event='GOVERNANCE_SUBMITTED' THEN
        SELECT count(*)
        INTO n
        FROM procurement_rollover_evidence_plans
        WHERE cycle_id=OLD.id;

        allowed:=
            OLD.status='PLAN_DRAFT'
            AND NEW.status='PLAN_REVIEW'
            AND n=OLD.expected_items;
    ELSIF NEW.last_event='GOVERNANCE_APPROVED' THEN
        allowed:=
            OLD.status='PLAN_REVIEW'
            AND NEW.status='PLAN_APPROVED';
    ELSIF NEW.last_event='GOVERNANCE_CLOSED' THEN
        allowed:=
            OLD.status='PLAN_APPROVED'
            AND NEW.status='OBSERVING';
    ELSIF NEW.last_event='EVIDENCE_SUBMITTED' THEN
        SELECT count(*)
        INTO n
        FROM procurement_rollover_evidence_observations
        WHERE cycle_id=OLD.id;

        allowed:=
            OLD.status='OBSERVING'
            AND NEW.status='EVIDENCE_REVIEW'
            AND n=OLD.expected_items;
    ELSIF NEW.last_event='EVIDENCE_VERIFIED' THEN
        m:=procureiq_rce91_metrics(OLD.id);

        allowed:=
            OLD.status='EVIDENCE_REVIEW'
            AND NEW.status='VERIFIED'
            AND (m->>'complete')::BOOLEAN;
    ELSIF NEW.last_event='EVIDENCE_CLOSED' THEN
        m:=procureiq_rce91_metrics(OLD.id);

        allowed:=
            OLD.status='VERIFIED'
            AND NEW.status='CLOSED'
            AND (m->>'remaining')::NUMERIC=0;
    END IF;

    IF allowed IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION USING
            ERRCODE='55000',
            MESSAGE='Invalid transition, incomplete coverage, or unresolved residual.';
    END IF;

    NEW.updated_at:=CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rce91_cycle_guard
BEFORE INSERT OR UPDATE OR DELETE
ON procurement_rollover_evidence_cycles
FOR EACH ROW
EXECUTE FUNCTION procureiq_rce91_cycle_guard();

CREATE FUNCTION procureiq_rce91_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO procurement_rollover_evidence_events(
        cycle_id,version,event_type,actor_id,actor_name,actor_role,note,status
    )
    SELECT
        NEW.id,NEW.version,NEW.last_event,NEW.last_actor,
        full_name,role::TEXT,NEW.last_note,NEW.status
    FROM app_users
    WHERE id=NEW.last_actor;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rce91_event
AFTER INSERT OR UPDATE
ON procurement_rollover_evidence_cycles
FOR EACH ROW
EXECUTE FUNCTION procureiq_rce91_event();

CREATE FUNCTION procureiq_rce91_item_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    c RECORD;
    src RECORD;
BEGIN
    IF TG_OP<>'INSERT' THEN
        RAISE EXCEPTION 'Cycle source items are immutable.';
    END IF;

    SELECT *
    INTO c
    FROM procurement_rollover_evidence_cycles
    WHERE id=NEW.cycle_id
    FOR UPDATE;

    IF NOT FOUND OR c.version<>0 THEN
        RAISE EXCEPTION 'The source baseline is already frozen.';
    END IF;

    IF c.parent_id IS NULL THEN
        SELECT *
        INTO src
        FROM procurement_remediation_continuation_rollover_items
        WHERE id=NEW.source_rollover_item_id;

        IF NOT FOUND
           OR src.rollover_case_id IS DISTINCT FROM c.root_rollover_id
           OR NEW.parent_item_id IS NOT NULL
           OR NEW.action IS DISTINCT FROM src.continuation_action
           OR NEW.opening_amount IS DISTINCT FROM
                src.source_remaining_residual_amount
        THEN
            RAISE EXCEPTION 'Source rollover item authority mismatch.';
        END IF;
    ELSE
        SELECT i.*,o.reduction_amount
        INTO src
        FROM procurement_rollover_evidence_items i
        JOIN procurement_rollover_evidence_observations o
            ON o.item_id=i.id
        WHERE i.id=NEW.parent_item_id;

        IF NOT FOUND
           OR src.cycle_id IS DISTINCT FROM c.parent_id
           OR NEW.source_rollover_item_id IS DISTINCT FROM
                src.source_rollover_item_id
           OR NEW.action IS DISTINCT FROM src.action
           OR NEW.opening_amount IS DISTINCT FROM
                src.opening_amount-src.reduction_amount
        THEN
            RAISE EXCEPTION
                'Parent item residual or action lineage mismatch.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rce91_item_guard
BEFORE INSERT OR UPDATE OR DELETE
ON procurement_rollover_evidence_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_rce91_item_guard();

CREATE FUNCTION procureiq_rce91_record_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    c RECORD;
    i RECORD;
    compatible BOOLEAN;
    not_before DATE;
BEGIN
    IF TG_OP<>'INSERT' THEN
        RAISE EXCEPTION 'Plans and observed evidence are immutable.';
    END IF;

    SELECT *
    INTO c
    FROM procurement_rollover_evidence_cycles
    WHERE id=NEW.cycle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Evidence cycle not found.';
    END IF;

    PERFORM procureiq_rce91_actor(NEW.actor_id,'WRITE');
    PERFORM procureiq_rce91_complete_baseline(c.id);

    SELECT *
    INTO i
    FROM procurement_rollover_evidence_items
    WHERE id=NEW.item_id;

    IF NOT FOUND
       OR i.cycle_id IS DISTINCT FROM c.id
       OR NEW.recorded_version<>c.version+1
    THEN
        RAISE EXCEPTION USING
            ERRCODE='55000',
            MESSAGE='Item ownership or expected version mismatch.';
    END IF;

    IF TG_TABLE_NAME='procurement_rollover_evidence_plans' THEN
        IF c.status<>'PLAN_DRAFT'
           OR NEW.target_date<CURRENT_DATE
           OR btrim(NEW.rationale)=''
        THEN
            RAISE EXCEPTION
                'A draft follow-up cycle, non-past target, and rationale are required.';
        END IF;
    ELSE
        IF c.status<>'OBSERVING' THEN
            RAISE EXCEPTION
                'Close governance before recording observed outcomes.';
        END IF;

        compatible:=
            CASE i.action
                WHEN 'RECOVERY_RETRY' THEN
                    NEW.resolution_type IN (
                        'RECOVERY_CONFIRMED','PARTIAL','UNRESOLVED'
                    )
                WHEN 'WRITE_OFF_ESCALATION' THEN
                    NEW.resolution_type IN (
                        'WRITE_OFF_CONFIRMED','PARTIAL','UNRESOLVED'
                    )
                WHEN 'INVESTIGATION_ESCALATION' THEN
                    NEW.resolution_type IN (
                        'INVESTIGATION_CONCLUDED','PARTIAL','UNRESOLVED'
                    )
                WHEN 'RISK_ACCEPTANCE_ESCALATION' THEN
                    NEW.resolution_type IN (
                        'RISK_ACCEPTANCE_CONFIRMED','UNRESOLVED'
                    )
                ELSE FALSE
            END;

        IF compatible IS DISTINCT FROM TRUE
           OR NEW.reduction_amount>i.opening_amount
           OR (
               NEW.resolution_type IN (
                   'RECOVERY_CONFIRMED','WRITE_OFF_CONFIRMED'
               )
               AND NEW.reduction_amount<=0
           )
           OR (
               NEW.resolution_type='PARTIAL'
               AND (
                   NEW.reduction_amount<=0
                   OR NEW.reduction_amount>=i.opening_amount
               )
           )
           OR (
               NEW.resolution_type IN (
                   'UNRESOLVED','RISK_ACCEPTANCE_CONFIRMED'
               )
               AND NEW.reduction_amount<>0
           )
        THEN
            RAISE EXCEPTION
                'Resolution type and observed reduction do not match the source action.';
        END IF;

        IF c.parent_id IS NULL THEN
            SELECT closed_at::DATE
            INTO not_before
            FROM procurement_remediation_continuation_rollover_cases
            WHERE id=c.root_rollover_id;
        ELSE
            SELECT max(occurred_at)::DATE
            INTO not_before
            FROM procurement_rollover_evidence_events
            WHERE cycle_id=c.id
              AND event_type='GOVERNANCE_CLOSED';
        END IF;

        IF NEW.observed_on>CURRENT_DATE
           OR (
               not_before IS NOT NULL
               AND NEW.observed_on<not_before
           )
           OR btrim(NEW.evidence_reference)=''
           OR btrim(NEW.evidence_note)=''
        THEN
            RAISE EXCEPTION
                'Evidence date must follow governance closure and cannot be in the future; reference and note are required.';
        END IF;
    END IF;

    NEW.created_at:=CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rce91_plan_guard
BEFORE INSERT OR UPDATE OR DELETE
ON procurement_rollover_evidence_plans
FOR EACH ROW
EXECUTE FUNCTION procureiq_rce91_record_guard();

CREATE TRIGGER trg_rce91_observation_guard
BEFORE INSERT OR UPDATE OR DELETE
ON procurement_rollover_evidence_observations
FOR EACH ROW
EXECUTE FUNCTION procureiq_rce91_record_guard();

CREATE FUNCTION procureiq_rce91_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    event_name TEXT;
    note_text TEXT;
BEGIN
    IF TG_TABLE_NAME='procurement_rollover_evidence_plans' THEN
        event_name:='PLAN_RECORDED';
        note_text:=NEW.rationale;
    ELSE
        event_name:='OBSERVATION_RECORDED';
        note_text:=NEW.evidence_reference;
    END IF;

    UPDATE procurement_rollover_evidence_cycles
    SET
        version=NEW.recorded_version,
        last_actor=NEW.actor_id,
        last_event=event_name,
        last_note=note_text
    WHERE id=NEW.cycle_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rce91_plan_touch
AFTER INSERT
ON procurement_rollover_evidence_plans
FOR EACH ROW
EXECUTE FUNCTION procureiq_rce91_touch();

CREATE TRIGGER trg_rce91_observation_touch
AFTER INSERT
ON procurement_rollover_evidence_observations
FOR EACH ROW
EXECUTE FUNCTION procureiq_rce91_touch();

CREATE FUNCTION procureiq_rce91_event_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    c RECORD;
    a RECORD;
BEGIN
    SELECT *
    INTO c
    FROM procurement_rollover_evidence_cycles
    WHERE id=NEW.cycle_id;

    SELECT full_name,role::TEXT AS role
    INTO a
    FROM app_users
    WHERE id=NEW.actor_id;

    IF NEW.version IS DISTINCT FROM c.version
       OR NEW.actor_id IS DISTINCT FROM c.last_actor
       OR NEW.event_type IS DISTINCT FROM c.last_event
       OR NEW.note IS DISTINCT FROM c.last_note
       OR NEW.status IS DISTINCT FROM c.status
       OR NEW.actor_name IS DISTINCT FROM a.full_name
       OR NEW.actor_role IS DISTINCT FROM a.role
    THEN
        RAISE EXCEPTION
            'Audit event must match the authoritative cycle transition.';
    END IF;

    NEW.occurred_at:=CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rce91_event_guard
BEFORE INSERT
ON procurement_rollover_evidence_events
FOR EACH ROW
EXECUTE FUNCTION procureiq_rce91_event_guard();

CREATE FUNCTION procureiq_rce91_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Evidence audit events and sealed snapshots are immutable.';
END;
$$;

CREATE TRIGGER trg_rce91_event_immutable
BEFORE UPDATE OR DELETE
ON procurement_rollover_evidence_events
FOR EACH ROW
EXECUTE FUNCTION procureiq_rce91_immutable();

CREATE TRIGGER trg_rce91_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_rollover_evidence_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_rce91_immutable();

CREATE FUNCTION procureiq_rce91_snapshot_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    c RECORD;
BEGIN
    PERFORM procureiq_rce91_actor(NEW.captured_by,'WRITE');

    SELECT *
    INTO c
    FROM procurement_rollover_evidence_cycles
    WHERE id=NEW.cycle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Evidence cycle not found.';
    END IF;

    PERFORM procureiq_rce91_complete_baseline(c.id);

    IF NEW.captured_version<>c.version
       OR NEW.document IS DISTINCT FROM procureiq_rce91_document(c.id)
    THEN
        RAISE EXCEPTION
            'Snapshot content must match authoritative evidence exactly.';
    END IF;

    NEW.captured_at:=CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rce91_snapshot_guard
BEFORE INSERT
ON procurement_rollover_evidence_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_rce91_snapshot_guard();

CREATE FUNCTION procureiq_rce91_capture(p_id UUID,p_actor UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    c RECORD;
    result UUID;
BEGIN
    PERFORM procureiq_rce91_actor(p_actor,'WRITE');

    SELECT *
    INTO c
    FROM procurement_rollover_evidence_cycles
    WHERE id=p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE='P0002',
            MESSAGE='Evidence cycle not found.';
    END IF;

    SELECT id
    INTO result
    FROM procurement_rollover_evidence_snapshots
    WHERE cycle_id=p_id
      AND captured_version=c.version;

    IF FOUND THEN
        RETURN result;
    END IF;

    INSERT INTO procurement_rollover_evidence_snapshots(
        cycle_id,captured_version,captured_by,document
    )
    VALUES(
        p_id,c.version,p_actor,procureiq_rce91_document(p_id)
    )
    RETURNING id INTO result;

    RETURN result;
END;
$$;

CREATE FUNCTION procureiq_rce91_open(
    p_root UUID,p_parent UUID,p_actor UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    src RECORD;
    result UUID:=gen_random_uuid();
    snap UUID;
    amount NUMERIC;
    n INTEGER;
BEGIN
    PERFORM procureiq_rce91_actor(p_actor,'WRITE');

    IF (p_root IS NULL)=(p_parent IS NULL) THEN
        RAISE EXCEPTION
            'Choose one source: rollover or verified parent cycle.';
    END IF;

    IF p_parent IS NULL THEN
        SELECT *
        INTO src
        FROM procurement_remediation_continuation_rollover_cases
        WHERE id=p_root
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING
                ERRCODE='P0002',
                MESSAGE='Source rollover not found.';
        END IF;

        INSERT INTO procurement_rollover_evidence_cycles(
            id,root_rollover_id,cycle_no,title,currency,fiscal_year,
            opening_amount,expected_items,status,
            created_by,last_actor,last_event,last_note
        )
        VALUES(
            result,p_root,1,src.title,src.currency,src.fiscal_year,
            src.source_remaining_residual_amount,
            src.source_residual_item_count,
            'OBSERVING',p_actor,p_actor,'OPENED',
            'Outcome evidence opened from a closed rollover.'
        );

        INSERT INTO procurement_rollover_evidence_items(
            cycle_id,source_rollover_item_id,action,opening_amount
        )
        SELECT
            result,id,continuation_action,source_remaining_residual_amount
        FROM procurement_remediation_continuation_rollover_items
        WHERE rollover_case_id=p_root;
    ELSE
        SELECT *
        INTO src
        FROM procurement_rollover_evidence_cycles
        WHERE id=p_parent
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING
                ERRCODE='P0002',
                MESSAGE='Parent evidence cycle not found.';
        END IF;

        IF src.status<>'VERIFIED' THEN
            RAISE EXCEPTION USING
                ERRCODE='55000',
                MESSAGE='Verify the parent evidence first.';
        END IF;

        SELECT id
        INTO snap
        FROM procurement_rollover_evidence_snapshots
        WHERE cycle_id=p_parent
          AND captured_version=src.version;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Verified parent snapshot is missing.';
        END IF;

        SELECT
            count(*),
            coalesce(sum(i.opening_amount-o.reduction_amount),0)
        INTO n,amount
        FROM procurement_rollover_evidence_items i
        JOIN procurement_rollover_evidence_observations o
            ON o.item_id=i.id
        WHERE i.cycle_id=p_parent
          AND i.opening_amount>o.reduction_amount;

        IF n=0 OR amount<=0 THEN
            RAISE EXCEPTION USING
                ERRCODE='55000',
                MESSAGE='A fully resolved cycle cannot roll forward.';
        END IF;

        INSERT INTO procurement_rollover_evidence_cycles(
            id,root_rollover_id,parent_id,source_snapshot_id,cycle_no,
            title,currency,fiscal_year,opening_amount,expected_items,
            status,created_by,last_actor,last_event,last_note
        )
        VALUES(
            result,src.root_rollover_id,p_parent,snap,src.cycle_no+1,
            src.title,src.currency,src.fiscal_year,amount,n,
            'PLAN_DRAFT',p_actor,p_actor,'OPENED',
            'Follow-up governance opened from verified remaining exposure.'
        );

        INSERT INTO procurement_rollover_evidence_items(
            cycle_id,source_rollover_item_id,parent_item_id,
            action,opening_amount
        )
        SELECT
            result,i.source_rollover_item_id,i.id,
            i.action,i.opening_amount-o.reduction_amount
        FROM procurement_rollover_evidence_items i
        JOIN procurement_rollover_evidence_observations o
            ON o.item_id=i.id
        WHERE i.cycle_id=p_parent
          AND i.opening_amount>o.reduction_amount;
    END IF;

    PERFORM procureiq_rce91_complete_baseline(result);
    RETURN result;
END;
$$;

CREATE FUNCTION procureiq_rce91_plan(
    p_id UUID,
    p_item UUID,
    p_version BIGINT,
    p_actor UUID,
    p_target DATE,
    p_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v BIGINT;
BEGIN
    PERFORM procureiq_rce91_actor(p_actor,'WRITE');

    SELECT version
    INTO v
    FROM procurement_rollover_evidence_cycles
    WHERE id=p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE='P0002',
            MESSAGE='Evidence cycle not found.';
    END IF;

    IF v IS DISTINCT FROM p_version THEN
        RAISE EXCEPTION USING
            ERRCODE='55000',
            MESSAGE='Stale cycle version. Reload before retrying.';
    END IF;

    INSERT INTO procurement_rollover_evidence_plans(
        item_id,cycle_id,target_date,rationale,actor_id,recorded_version
    )
    VALUES(
        p_item,p_id,p_target,btrim(p_note),p_actor,v+1
    );
END;
$$;

CREATE FUNCTION procureiq_rce91_observe(
    p_id UUID,
    p_item UUID,
    p_version BIGINT,
    p_actor UUID,
    p_resolution TEXT,
    p_reduction NUMERIC,
    p_date DATE,
    p_reference TEXT,
    p_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v BIGINT;
BEGIN
    PERFORM procureiq_rce91_actor(p_actor,'WRITE');

    SELECT version
    INTO v
    FROM procurement_rollover_evidence_cycles
    WHERE id=p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE='P0002',
            MESSAGE='Evidence cycle not found.';
    END IF;

    IF v IS DISTINCT FROM p_version THEN
        RAISE EXCEPTION USING
            ERRCODE='55000',
            MESSAGE='Stale cycle version. Reload before retrying.';
    END IF;

    INSERT INTO procurement_rollover_evidence_observations(
        item_id,cycle_id,resolution_type,reduction_amount,
        observed_on,evidence_reference,evidence_note,
        actor_id,recorded_version
    )
    VALUES(
        p_item,p_id,p_resolution,p_reduction,p_date,
        btrim(p_reference),btrim(p_note),p_actor,v+1
    );
END;
$$;

CREATE FUNCTION procureiq_rce91_transition(
    p_id UUID,
    p_version BIGINT,
    p_actor UUID,
    p_operation TEXT,
    p_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    c RECORD;
    next_status TEXT;
    event_name TEXT;
BEGIN
    PERFORM procureiq_rce91_actor(
        p_actor,
        CASE
            WHEN p_operation IN (
                'approve-plan',
                'close-governance',
                'verify-evidence',
                'close-evidence'
            ) THEN 'MANAGER'
            ELSE 'WRITE'
        END
    );

    SELECT *
    INTO c
    FROM procurement_rollover_evidence_cycles
    WHERE id=p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE='P0002',
            MESSAGE='Evidence cycle not found.';
    END IF;

    IF c.version IS DISTINCT FROM p_version THEN
        RAISE EXCEPTION USING
            ERRCODE='55000',
            MESSAGE='Stale cycle version. Reload before retrying.';
    END IF;

    CASE p_operation
        WHEN 'submit-plan' THEN
            next_status:='PLAN_REVIEW';
            event_name:='GOVERNANCE_SUBMITTED';
        WHEN 'approve-plan' THEN
            next_status:='PLAN_APPROVED';
            event_name:='GOVERNANCE_APPROVED';
        WHEN 'close-governance' THEN
            next_status:='OBSERVING';
            event_name:='GOVERNANCE_CLOSED';
        WHEN 'submit-evidence' THEN
            next_status:='EVIDENCE_REVIEW';
            event_name:='EVIDENCE_SUBMITTED';
        WHEN 'verify-evidence' THEN
            next_status:='VERIFIED';
            event_name:='EVIDENCE_VERIFIED';
        WHEN 'close-evidence' THEN
            next_status:='CLOSED';
            event_name:='EVIDENCE_CLOSED';
        ELSE
            RAISE EXCEPTION 'Unknown lifecycle operation.';
    END CASE;

    UPDATE procurement_rollover_evidence_cycles
    SET
        status=next_status,
        version=version+1,
        last_actor=p_actor,
        last_event=event_name,
        last_note=btrim(p_note)
    WHERE id=p_id;

    IF event_name IN (
        'GOVERNANCE_APPROVED',
        'GOVERNANCE_CLOSED',
        'EVIDENCE_VERIFIED',
        'EVIDENCE_CLOSED'
    ) THEN
        PERFORM procureiq_rce91_capture(p_id,p_actor);
    END IF;
END;
$$;

CREATE FUNCTION procureiq_rce91_detail(p_id UUID,p_actor UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    role_name TEXT;
    doc JSONB;
BEGIN
    role_name:=procureiq_rce91_actor(p_actor,'READ');
    doc:=procureiq_rce91_document(p_id);

    IF doc IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE='P0002',
            MESSAGE='Evidence cycle not found.';
    END IF;

    RETURN doc||jsonb_build_object(
        'permissions',jsonb_build_object(
            'write',role_name<>'APPROVER',
            'manage',role_name IN ('PROCUREMENT_MANAGER','ADMIN')
        ),
        'nextCycleId',(
            SELECT id
            FROM procurement_rollover_evidence_cycles
            WHERE parent_id=p_id
        ),
        'snapshots',coalesce(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id',s.id,
                        'version',s.captured_version,
                        'capturedAt',s.captured_at
                    )
                    ORDER BY s.captured_version DESC
                )
                FROM procurement_rollover_evidence_snapshots s
                WHERE s.cycle_id=p_id
            ),
            '[]'::JSONB
        )
    );
END;
$$;

CREATE FUNCTION procureiq_rce91_snapshot(p_id UUID,p_actor UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
BEGIN
    PERFORM procureiq_rce91_actor(p_actor,'READ');

    SELECT jsonb_build_object(
        'id',id,
        'capturedAt',captured_at,
        'document',document
    )
    INTO result
    FROM procurement_rollover_evidence_snapshots
    WHERE id=p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE='P0002',
            MESSAGE='Snapshot not found.';
    END IF;

    RETURN result;
END;
$$;

CREATE FUNCTION procureiq_rce91_dashboard(p_actor UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    role_name TEXT;
    result JSONB;
BEGIN
    role_name:=procureiq_rce91_actor(p_actor,'READ');

    SELECT jsonb_build_object(
        'permissions',jsonb_build_object(
            'write',role_name<>'APPROVER',
            'manage',role_name IN ('PROCUREMENT_MANAGER','ADMIN')
        ),
        'sources',coalesce(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id',r.id,
                        'number',r.rollover_number,
                        'title',r.title,
                        'currency',r.currency,
                        'amount',r.source_remaining_residual_amount::TEXT
                    )
                    ORDER BY r.created_at DESC
                )
                FROM procurement_remediation_continuation_rollover_cases r
                WHERE r.status='CLOSED'
                  AND NOT EXISTS(
                      SELECT 1
                      FROM procurement_rollover_evidence_cycles c
                      WHERE c.root_rollover_id=r.id
                        AND c.parent_id IS NULL
                  )
            ),
            '[]'::JSONB
        ),
        'cycles',coalesce(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'cycle',procureiq_rce91_document(c.id)->'cycle',
                        'metrics',procureiq_rce91_metrics(c.id),
                        'isLatest',NOT EXISTS(
                            SELECT 1
                            FROM procurement_rollover_evidence_cycles child
                            WHERE child.parent_id=c.id
                        )
                    )
                    ORDER BY c.created_at DESC,c.cycle_no DESC
                )
                FROM procurement_rollover_evidence_cycles c
            ),
            '[]'::JSONB
        ),
        'exposure',coalesce(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'currency',t.currency,
                        'original',t.original::TEXT,
                        'remaining',t.remaining::TEXT,
                        'cumulativeReduction',(t.original-t.remaining)::TEXT
                    )
                    ORDER BY t.currency
                )
                FROM (
                    SELECT
                        leaf.currency,
                        sum(root.opening_amount) AS original,
                        sum(
                            (
                                procureiq_rce91_metrics(leaf.id)->>'remaining'
                            )::NUMERIC
                        ) AS remaining
                    FROM procurement_rollover_evidence_cycles leaf
                    JOIN procurement_rollover_evidence_cycles root
                        ON root.root_rollover_id=leaf.root_rollover_id
                       AND root.parent_id IS NULL
                    WHERE NOT EXISTS(
                        SELECT 1
                        FROM procurement_rollover_evidence_cycles child
                        WHERE child.parent_id=leaf.id
                    )
                    GROUP BY leaf.currency
                ) t
            ),
            '[]'::JSONB
        )
    )
    INTO result;

    RETURN result;
END;
$$;
