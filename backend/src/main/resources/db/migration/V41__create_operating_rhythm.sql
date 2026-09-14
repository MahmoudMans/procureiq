CREATE SEQUENCE procurement_operating_rhythm_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_operating_rhythm_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number
        VARCHAR(50)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    period_start
        DATE
        NOT NULL,

    period_end
        DATE
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    active_backlog_count
        BIGINT
        NOT NULL,

    critical_backlog_count
        BIGINT
        NOT NULL,

    high_backlog_count
        BIGINT
        NOT NULL,

    sla_overdue_count
        BIGINT
        NOT NULL,

    unassigned_count
        BIGINT
        NOT NULL,

    persistent_exception_count
        BIGINT
        NOT NULL,

    resolved_count
        BIGINT
        NOT NULL,

    on_time_resolved_count
        BIGINT
        NOT NULL,

    late_resolved_count
        BIGINT
        NOT NULL,

    sla_attainment_pct
        NUMERIC(7, 2)
        NOT NULL,

    avg_resolution_hours
        NUMERIC(12, 2)
        NOT NULL,

    avg_active_age_days
        NUMERIC(12, 2)
        NOT NULL,

    active_monetary_exposure
        NUMERIC(19, 2)
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_operating_rhythm_snapshot_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_operating_rhythm_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_operating_rhythm_snapshot_period
        CHECK (
            period_end >= period_start
        ),

    CONSTRAINT ck_operating_rhythm_sla_attainment
        CHECK (
            sla_attainment_pct
                BETWEEN 0 AND 100
        ),

    CONSTRAINT ck_operating_rhythm_nonnegative
        CHECK (
            active_backlog_count >= 0
            AND critical_backlog_count >= 0
            AND high_backlog_count >= 0
            AND sla_overdue_count >= 0
            AND unassigned_count >= 0
            AND persistent_exception_count >= 0
            AND resolved_count >= 0
            AND on_time_resolved_count >= 0
            AND late_resolved_count >= 0
            AND avg_resolution_hours >= 0
            AND avg_active_age_days >= 0
            AND active_monetary_exposure >= 0
        )
);

CREATE TABLE procurement_operating_rhythm_dimensions (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    dimension_type
        VARCHAR(30)
        NOT NULL,

    dimension_key
        VARCHAR(160)
        NOT NULL,

    dimension_label
        VARCHAR(240)
        NOT NULL,

    active_count
        BIGINT
        NOT NULL,

    sla_overdue_count
        BIGINT
        NOT NULL,

    persistent_count
        BIGINT
        NOT NULL,

    resolved_count
        BIGINT
        NOT NULL,

    on_time_resolved_count
        BIGINT
        NOT NULL,

    sla_attainment_pct
        NUMERIC(7, 2)
        NOT NULL,

    avg_resolution_hours
        NUMERIC(12, 2)
        NOT NULL,

    avg_active_age_days
        NUMERIC(12, 2)
        NOT NULL,

    active_exposure
        NUMERIC(19, 2)
        NOT NULL,

    workload_share_pct
        NUMERIC(7, 2)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_operating_rhythm_dimension_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_operating_rhythm_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_operating_rhythm_dimension
        UNIQUE (
            snapshot_id,
            dimension_type,
            dimension_key
        ),

    CONSTRAINT ck_operating_rhythm_dimension_type
        CHECK (
            dimension_type IN (
                'DOMAIN',
                'OWNER',
                'SEVERITY',
                'EXCEPTION_TYPE'
            )
        ),

    CONSTRAINT ck_operating_rhythm_dimension_percentages
        CHECK (
            sla_attainment_pct
                BETWEEN 0 AND 100
            AND workload_share_pct
                BETWEEN 0 AND 100
        )
);

CREATE INDEX idx_operating_rhythm_snapshot_scope
    ON procurement_operating_rhythm_snapshots (
        currency,
        captured_at DESC
    );

CREATE INDEX idx_operating_rhythm_snapshot_period
    ON procurement_operating_rhythm_snapshots (
        currency,
        period_start,
        period_end
    );

CREATE INDEX idx_operating_rhythm_dimension_lookup
    ON procurement_operating_rhythm_dimensions (
        snapshot_id,
        dimension_type,
        active_count DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_operating_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Operating rhythm snapshots are immutable';
END;
$$;

CREATE TRIGGER trg_operating_rhythm_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_operating_rhythm_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_operating_snapshot_mutation();

CREATE TRIGGER trg_operating_rhythm_dimension_immutable
BEFORE UPDATE OR DELETE
ON procurement_operating_rhythm_dimensions
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_operating_snapshot_mutation();

CREATE TRIGGER trg_audit_procurement_operating_rhythm_snapshots
AFTER INSERT
ON procurement_operating_rhythm_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
