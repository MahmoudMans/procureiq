CREATE SEQUENCE procurement_capital_flywheel_lineage_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_capital_flywheel_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_capital_flywheel_lineages (
    id UUID PRIMARY KEY,

    lineage_number
        VARCHAR(60)
        NOT NULL,

    root_persistence_case_id
        UUID
        NOT NULL,

    root_persistence_case_number
        VARCHAR(60)
        NOT NULL,

    root_target_value_case_id
        UUID
        NOT NULL,

    root_target_value_case_number
        VARCHAR(60)
        NOT NULL,

    root_target_initiative_title
        VARCHAR(300)
        NOT NULL,

    original_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    root_fiscal_year
        INTEGER
        NOT NULL,

    maximum_cycle_count
        INTEGER
        NOT NULL,

    minimum_marginal_value_multiple
        NUMERIC(10, 4)
        NOT NULL,

    minimum_cycle_efficiency_retention_pct
        NUMERIC(7, 2)
        NOT NULL,

    diminishing_return_tolerance_pct
        NUMERIC(7, 2)
        NOT NULL,

    lineage_owner_user_id
        UUID
        NOT NULL,

    lineage_owner_name_snapshot
        VARCHAR(300)
        NOT NULL,

    lineage_objective
        VARCHAR(5000)
        NOT NULL,

    status
        VARCHAR(40)
        NOT NULL,

    closed_by_user_id
        UUID,

    closed_at
        TIMESTAMPTZ,

    close_note
        VARCHAR(5000),

    created_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    version
        BIGINT
        NOT NULL
        DEFAULT 0,

    CONSTRAINT uk_capital_flywheel_lineage_number
        UNIQUE (
            lineage_number
        ),

    CONSTRAINT fk_capital_flywheel_root_persistence
        FOREIGN KEY (
            root_persistence_case_id
        )
        REFERENCES procurement_reinvestment_persistence_cases (id),

    CONSTRAINT fk_capital_flywheel_root_target
        FOREIGN KEY (
            root_target_value_case_id
        )
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_capital_flywheel_owner
        FOREIGN KEY (
            lineage_owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_capital_flywheel_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_capital_flywheel_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capital_flywheel_original_capital
        CHECK (
            original_capital_amount > 0
        ),

    CONSTRAINT ck_capital_flywheel_max_cycles
        CHECK (
            maximum_cycle_count
                BETWEEN 1 AND 20
        ),

    CONSTRAINT ck_capital_flywheel_marginal_multiple
        CHECK (
            minimum_marginal_value_multiple
                BETWEEN 0 AND 10
        ),

    CONSTRAINT ck_capital_flywheel_efficiency_threshold
        CHECK (
            minimum_cycle_efficiency_retention_pct
                BETWEEN 50 AND 200
        ),

    CONSTRAINT ck_capital_flywheel_diminishing_threshold
        CHECK (
            diminishing_return_tolerance_pct
                BETWEEN 10 AND 100
        ),

    CONSTRAINT ck_capital_flywheel_status
        CHECK (
            status IN (
                'READY_FOR_REVIEW',
                'APPROVED_FOR_NEXT_CYCLE',
                'STOPPED',
                'CLOSED'
            )
        )
);

CREATE TABLE procurement_capital_flywheel_cycles (
    id UUID PRIMARY KEY,

    lineage_id
        UUID
        NOT NULL,

    cycle_index
        INTEGER
        NOT NULL,

    persistence_case_id
        UUID
        NOT NULL,

    persistence_case_number
        VARCHAR(60)
        NOT NULL,

    source_performance_case_number
        VARCHAR(60)
        NOT NULL,

    redeployment_number
        VARCHAR(60)
        NOT NULL,

    recycling_source_number
        VARCHAR(60)
        NOT NULL,

    target_value_case_id
        UUID
        NOT NULL,

    target_value_case_number
        VARCHAR(60)
        NOT NULL,

    target_initiative_title
        VARCHAR(300)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    redeployed_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    baseline_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    projected_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    projected_horizon_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    projected_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    value_persistence_pct
        NUMERIC(7, 2)
        NOT NULL,

    efficiency_retention_pct
        NUMERIC(7, 2)
        NOT NULL,

    capital_efficiency_multiple
        NUMERIC(14, 4)
        NOT NULL,

    compounding_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    decayed_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    persistence_health
        VARCHAR(30)
        NOT NULL,

    relationship_rationale
        VARCHAR(5000)
        NOT NULL,

    added_by_user_id
        UUID
        NOT NULL,

    added_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_capital_flywheel_cycle_index
        UNIQUE (
            lineage_id,
            cycle_index
        ),

    CONSTRAINT uk_capital_flywheel_persistence_case
        UNIQUE (
            persistence_case_id
        ),

    CONSTRAINT fk_capital_flywheel_cycle_lineage
        FOREIGN KEY (
            lineage_id
        )
        REFERENCES procurement_capital_flywheel_lineages (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_capital_flywheel_cycle_persistence
        FOREIGN KEY (
            persistence_case_id
        )
        REFERENCES procurement_reinvestment_persistence_cases (id),

    CONSTRAINT fk_capital_flywheel_cycle_target
        FOREIGN KEY (
            target_value_case_id
        )
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_capital_flywheel_cycle_user
        FOREIGN KEY (
            added_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capital_flywheel_cycle_index
        CHECK (
            cycle_index >= 1
        ),

    CONSTRAINT ck_capital_flywheel_cycle_capital
        CHECK (
            redeployed_capital_amount > 0
        ),

    CONSTRAINT ck_capital_flywheel_cycle_pct
        CHECK (
            value_persistence_pct
                BETWEEN 0 AND 999.99
            AND
            efficiency_retention_pct
                BETWEEN 0 AND 999.99
        ),

    CONSTRAINT ck_capital_flywheel_cycle_health
        CHECK (
            persistence_health IN (
                'COMPOUNDING',
                'SUSTAINED'
            )
        )
);

CREATE TABLE procurement_capital_flywheel_reviews (
    id UUID PRIMARY KEY,

    lineage_id
        UUID
        NOT NULL,

    latest_cycle_id
        UUID
        NOT NULL,

    cycle_count
        INTEGER
        NOT NULL,

    recommendation
        VARCHAR(20)
        NOT NULL,

    decision
        VARCHAR(30)
        NOT NULL,

    override_flag
        BOOLEAN
        NOT NULL,

    diminishing_returns
        BOOLEAN
        NOT NULL,

    cumulative_projected_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    cumulative_compounding_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    cumulative_decayed_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    cumulative_value_multiple
        NUMERIC(14, 4)
        NOT NULL,

    latest_marginal_value_multiple
        NUMERIC(14, 4)
        NOT NULL,

    latest_marginal_net_value_retention_pct
        NUMERIC(7, 2)
        NOT NULL,

    latest_cycle_efficiency_retention_pct
        NUMERIC(7, 2)
        NOT NULL,

    latest_cycle_value_persistence_pct
        NUMERIC(7, 2)
        NOT NULL,

    latest_cycle_projected_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    flywheel_health
        VARCHAR(30)
        NOT NULL,

    decision_note
        VARCHAR(5000)
        NOT NULL,

    reviewed_by_user_id
        UUID
        NOT NULL,

    reviewed_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_capital_flywheel_review_lineage
        FOREIGN KEY (
            lineage_id
        )
        REFERENCES procurement_capital_flywheel_lineages (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_capital_flywheel_review_latest_cycle
        FOREIGN KEY (
            latest_cycle_id
        )
        REFERENCES procurement_capital_flywheel_cycles (id),

    CONSTRAINT fk_capital_flywheel_review_user
        FOREIGN KEY (
            reviewed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capital_flywheel_review_recommendation
        CHECK (
            recommendation IN (
                'CONTINUE',
                'HOLD',
                'STOP'
            )
        ),

    CONSTRAINT ck_capital_flywheel_review_decision
        CHECK (
            decision IN (
                'CONTINUE_APPROVED',
                'STOPPED'
            )
        ),

    CONSTRAINT ck_capital_flywheel_review_health
        CHECK (
            flywheel_health IN (
                'SINGLE_CYCLE',
                'COMPOUNDING',
                'HEALTHY',
                'DIMINISHING',
                'EXHAUSTED'
            )
        ),

    CONSTRAINT ck_capital_flywheel_review_percentages
        CHECK (
            latest_marginal_net_value_retention_pct
                BETWEEN 0 AND 999.99
            AND
            latest_cycle_efficiency_retention_pct
                BETWEEN 0 AND 999.99
            AND
            latest_cycle_value_persistence_pct
                BETWEEN 0 AND 999.99
        )
);

CREATE TABLE procurement_capital_flywheel_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number
        VARCHAR(60)
        NOT NULL,

    lineage_count
        INTEGER
        NOT NULL,

    review_pending_lineage_count
        INTEGER
        NOT NULL,

    approved_next_cycle_lineage_count
        INTEGER
        NOT NULL,

    stopped_lineage_count
        INTEGER
        NOT NULL,

    total_cycle_count
        INTEGER
        NOT NULL,

    total_original_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_cumulative_projected_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_compounding_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_decayed_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    average_cumulative_value_multiple
        NUMERIC(14, 4)
        NOT NULL,

    average_latest_marginal_value_multiple
        NUMERIC(14, 4)
        NOT NULL,

    diminishing_return_lineage_count
        INTEGER
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_capital_flywheel_snapshot_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_capital_flywheel_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id)
);

CREATE TABLE procurement_capital_flywheel_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    lineage_id
        UUID
        NOT NULL,

    lineage_number
        VARCHAR(60)
        NOT NULL,

    root_target_initiative_title
        VARCHAR(300)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    lineage_status
        VARCHAR(40)
        NOT NULL,

    cycle_count
        INTEGER
        NOT NULL,

    original_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    cumulative_projected_net_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    cumulative_compounding_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    cumulative_decayed_value_amount
        NUMERIC(20, 2)
        NOT NULL,

    cumulative_value_multiple
        NUMERIC(14, 4)
        NOT NULL,

    latest_marginal_value_multiple
        NUMERIC(14, 4)
        NOT NULL,

    latest_marginal_net_value_retention_pct
        NUMERIC(7, 2)
        NOT NULL,

    diminishing_returns
        BOOLEAN
        NOT NULL,

    flywheel_health
        VARCHAR(30)
        NOT NULL,

    recommendation
        VARCHAR(20)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_capital_flywheel_snapshot_item_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_capital_flywheel_snapshots (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_capital_flywheel_lineage_status
    ON procurement_capital_flywheel_lineages (
        status,
        root_fiscal_year,
        currency
    );

CREATE INDEX idx_capital_flywheel_cycle_lineage
    ON procurement_capital_flywheel_cycles (
        lineage_id,
        cycle_index
    );

CREATE INDEX idx_capital_flywheel_review_lineage
    ON procurement_capital_flywheel_reviews (
        lineage_id,
        reviewed_at DESC
    );

CREATE INDEX idx_capital_flywheel_snapshot_capture
    ON procurement_capital_flywheel_snapshots (
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_capital_flywheel_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement capital flywheel evidence is immutable';
END;
$$;

CREATE TRIGGER trg_capital_flywheel_cycle_immutable
BEFORE UPDATE OR DELETE
ON procurement_capital_flywheel_cycles
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capital_flywheel_evidence_mutation();

CREATE TRIGGER trg_capital_flywheel_review_immutable
BEFORE UPDATE OR DELETE
ON procurement_capital_flywheel_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capital_flywheel_evidence_mutation();

CREATE TRIGGER trg_capital_flywheel_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_capital_flywheel_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capital_flywheel_evidence_mutation();

CREATE TRIGGER trg_capital_flywheel_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_capital_flywheel_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capital_flywheel_evidence_mutation();

CREATE TRIGGER trg_audit_capital_flywheel_lineages
AFTER INSERT OR UPDATE
ON procurement_capital_flywheel_lineages
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capital_flywheel_cycles
AFTER INSERT
ON procurement_capital_flywheel_cycles
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capital_flywheel_reviews
AFTER INSERT
ON procurement_capital_flywheel_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capital_flywheel_snapshots
AFTER INSERT
ON procurement_capital_flywheel_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
