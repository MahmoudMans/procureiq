CREATE SEQUENCE procurement_alignment_review_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_strategic_alignment_links (
    id UUID PRIMARY KEY,

    objective_id
        UUID
        NOT NULL,

    source_type
        VARCHAR(40)
        NOT NULL,

    source_entity_id
        UUID
        NOT NULL,

    source_reference_snapshot
        VARCHAR(180)
        NOT NULL,

    source_title_snapshot
        VARCHAR(500)
        NOT NULL,

    alignment_role
        VARCHAR(30)
        NOT NULL,

    allocation_pct
        NUMERIC(7, 2)
        NOT NULL,

    rationale
        VARCHAR(3000)
        NOT NULL,

    created_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_strategic_alignment_objective
        FOREIGN KEY (
            objective_id
        )
        REFERENCES procurement_strategic_objectives (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_strategic_alignment_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_strategic_alignment_link
        UNIQUE (
            objective_id,
            source_type,
            source_entity_id
        ),

    CONSTRAINT ck_strategic_alignment_source_type
        CHECK (
            source_type IN (
                'CATEGORY_INITIATIVE',
                'IMPROVEMENT_INITIATIVE',
                'EXECUTION_PORTFOLIO',
                'RISK_ESCALATION'
            )
        ),

    CONSTRAINT ck_strategic_alignment_role
        CHECK (
            alignment_role IN (
                'PRIMARY',
                'ENABLER',
                'VALUE_DELIVERY',
                'RISK_MITIGATION'
            )
        ),

    CONSTRAINT ck_strategic_alignment_allocation
        CHECK (
            allocation_pct > 0
            AND allocation_pct <= 100
        )
);

CREATE TABLE procurement_alignment_reviews (
    id UUID PRIMARY KEY,

    review_number
        VARCHAR(50)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    objective_count
        INTEGER
        NOT NULL,

    objectives_with_alignment
        INTEGER
        NOT NULL,

    candidate_source_count
        INTEGER
        NOT NULL,

    aligned_source_count
        INTEGER
        NOT NULL,

    unaligned_source_count
        INTEGER
        NOT NULL,

    fully_aligned_source_count
        INTEGER
        NOT NULL,

    partially_aligned_source_count
        INTEGER
        NOT NULL,

    split_commitment_count
        INTEGER
        NOT NULL,

    deadline_conflict_count
        INTEGER
        NOT NULL,

    strategic_value_total
        NUMERIC(19, 2)
        NOT NULL,

    strategic_value_aligned
        NUMERIC(19, 2)
        NOT NULL,

    risk_exposure_total
        NUMERIC(19, 2)
        NOT NULL,

    risk_exposure_aligned
        NUMERIC(19, 2)
        NOT NULL,

    source_coverage_pct
        NUMERIC(7, 2)
        NOT NULL,

    objective_coverage_pct
        NUMERIC(7, 2)
        NOT NULL,

    value_coverage_pct
        NUMERIC(7, 2)
        NOT NULL,

    risk_coverage_pct
        NUMERIC(7, 2)
        NOT NULL,

    schedule_alignment_pct
        NUMERIC(7, 2)
        NOT NULL,

    alignment_score
        NUMERIC(7, 2)
        NOT NULL,

    alignment_health
        VARCHAR(20)
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_alignment_review_number
        UNIQUE (
            review_number
        ),

    CONSTRAINT fk_alignment_review_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_alignment_review_health
        CHECK (
            alignment_health IN (
                'EXCELLENT',
                'STRONG',
                'WATCH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_alignment_review_percentages
        CHECK (
            source_coverage_pct BETWEEN 0 AND 100
            AND objective_coverage_pct BETWEEN 0 AND 100
            AND value_coverage_pct BETWEEN 0 AND 100
            AND risk_coverage_pct BETWEEN 0 AND 100
            AND schedule_alignment_pct BETWEEN 0 AND 100
            AND alignment_score BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_alignment_review_items (
    id UUID PRIMARY KEY,

    review_id
        UUID
        NOT NULL,

    source_type
        VARCHAR(40)
        NOT NULL,

    source_entity_id
        UUID
        NOT NULL,

    source_reference
        VARCHAR(180)
        NOT NULL,

    source_title
        VARCHAR(500)
        NOT NULL,

    source_status
        VARCHAR(60)
        NOT NULL,

    strategic_value
        NUMERIC(19, 2)
        NOT NULL,

    risk_exposure
        NUMERIC(19, 2)
        NOT NULL,

    risk_score
        NUMERIC(7, 2)
        NOT NULL,

    due_date
        DATE,

    direct_allocation_pct
        NUMERIC(7, 2)
        NOT NULL,

    linked_objective_count
        INTEGER
        NOT NULL,

    okr_contribution_count
        INTEGER
        NOT NULL,

    alignment_status
        VARCHAR(20)
        NOT NULL,

    split_commitment
        BOOLEAN
        NOT NULL,

    deadline_conflict_count
        INTEGER
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_alignment_review_item_review
        FOREIGN KEY (
            review_id
        )
        REFERENCES procurement_alignment_reviews (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_alignment_review_source
        UNIQUE (
            review_id,
            source_type,
            source_entity_id
        ),

    CONSTRAINT ck_alignment_review_item_status
        CHECK (
            alignment_status IN (
                'UNALIGNED',
                'PARTIAL',
                'FULL',
                'CONFLICT'
            )
        ),

    CONSTRAINT ck_alignment_review_item_allocation
        CHECK (
            direct_allocation_pct >= 0
        )
);

CREATE INDEX idx_alignment_link_objective
    ON procurement_strategic_alignment_links (
        objective_id
    );

CREATE INDEX idx_alignment_link_source
    ON procurement_strategic_alignment_links (
        source_type,
        source_entity_id
    );

CREATE INDEX idx_alignment_review_scope
    ON procurement_alignment_reviews (
        currency,
        fiscal_year,
        captured_at DESC
    );

CREATE INDEX idx_alignment_review_item_review
    ON procurement_alignment_review_items (
        review_id,
        alignment_status
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_alignment_review_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Strategic alignment reviews are immutable';
END;
$$;

CREATE TRIGGER trg_alignment_review_immutable
BEFORE UPDATE OR DELETE
ON procurement_alignment_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_alignment_review_mutation();

CREATE TRIGGER trg_alignment_review_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_alignment_review_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_alignment_review_mutation();

CREATE TRIGGER trg_audit_strategic_alignment_links
AFTER INSERT OR DELETE
ON procurement_strategic_alignment_links
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_alignment_reviews
AFTER INSERT
ON procurement_alignment_reviews
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
