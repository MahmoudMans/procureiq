ALTER TABLE rfqs
    DROP CONSTRAINT ck_rfqs_status;

ALTER TABLE rfqs
    ADD CONSTRAINT ck_rfqs_status
    CHECK (
        status IN (
            'DRAFT',
            'PUBLISHED',
            'CLOSED',
            'AWARDED',
            'CANCELLED'
        )
    );

CREATE TABLE rfq_evaluation_weights (
    id UUID PRIMARY KEY,

    rfq_id
        UUID
        NOT NULL,

    price_weight
        NUMERIC(5, 2)
        NOT NULL,

    delivery_weight
        NUMERIC(5, 2)
        NOT NULL,

    supplier_rating_weight
        NUMERIC(5, 2)
        NOT NULL,

    risk_weight
        NUMERIC(5, 2)
        NOT NULL,

    quality_weight
        NUMERIC(5, 2)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_rfq_evaluation_weights_rfq
        UNIQUE (
            rfq_id
        ),

    CONSTRAINT fk_rfq_evaluation_weights_rfq
        FOREIGN KEY (
            rfq_id
        )
        REFERENCES rfqs (id),

    CONSTRAINT ck_rfq_evaluation_weights_price
        CHECK (
            price_weight >= 0
            AND price_weight <= 100
        ),

    CONSTRAINT ck_rfq_evaluation_weights_delivery
        CHECK (
            delivery_weight >= 0
            AND delivery_weight <= 100
        ),

    CONSTRAINT ck_rfq_evaluation_weights_rating
        CHECK (
            supplier_rating_weight >= 0
            AND supplier_rating_weight <= 100
        ),

    CONSTRAINT ck_rfq_evaluation_weights_risk
        CHECK (
            risk_weight >= 0
            AND risk_weight <= 100
        ),

    CONSTRAINT ck_rfq_evaluation_weights_quality
        CHECK (
            quality_weight >= 0
            AND quality_weight <= 100
        ),

    CONSTRAINT ck_rfq_evaluation_weights_total
        CHECK (
            price_weight
            + delivery_weight
            + supplier_rating_weight
            + risk_weight
            + quality_weight
            = 100
        )
);

CREATE TABLE supplier_evaluations (
    id UUID PRIMARY KEY,

    rfq_id
        UUID
        NOT NULL,

    quotation_id
        UUID
        NOT NULL,

    price_score
        NUMERIC(5, 2)
        NOT NULL,

    delivery_score
        NUMERIC(5, 2)
        NOT NULL,

    supplier_rating_score
        NUMERIC(5, 2)
        NOT NULL,

    risk_score
        NUMERIC(5, 2)
        NOT NULL,

    quality_score
        NUMERIC(5, 2)
        NOT NULL,

    weighted_total_score
        NUMERIC(5, 2)
        NOT NULL,

    rank_position
        INTEGER
        NOT NULL,

    recommended
        BOOLEAN
        NOT NULL,

    calculated_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_supplier_evaluation_quotation
        UNIQUE (
            quotation_id
        ),

    CONSTRAINT uk_supplier_evaluation_rank
        UNIQUE (
            rfq_id,
            rank_position
        ),

    CONSTRAINT fk_supplier_evaluation_rfq
        FOREIGN KEY (
            rfq_id
        )
        REFERENCES rfqs (id),

    CONSTRAINT fk_supplier_evaluation_quotation
        FOREIGN KEY (
            quotation_id
        )
        REFERENCES quotations (id),

    CONSTRAINT ck_supplier_evaluation_price
        CHECK (
            price_score >= 0
            AND price_score <= 100
        ),

    CONSTRAINT ck_supplier_evaluation_delivery
        CHECK (
            delivery_score >= 0
            AND delivery_score <= 100
        ),

    CONSTRAINT ck_supplier_evaluation_rating
        CHECK (
            supplier_rating_score >= 0
            AND supplier_rating_score <= 100
        ),

    CONSTRAINT ck_supplier_evaluation_risk
        CHECK (
            risk_score >= 0
            AND risk_score <= 100
        ),

    CONSTRAINT ck_supplier_evaluation_quality
        CHECK (
            quality_score >= 0
            AND quality_score <= 100
        ),

    CONSTRAINT ck_supplier_evaluation_total
        CHECK (
            weighted_total_score >= 0
            AND weighted_total_score <= 100
        ),

    CONSTRAINT ck_supplier_evaluation_rank
        CHECK (
            rank_position >= 1
        )
);

CREATE TABLE award_decisions (
    id UUID PRIMARY KEY,

    rfq_id
        UUID
        NOT NULL,

    selected_quotation_id
        UUID
        NOT NULL,

    recommended_quotation_id
        UUID
        NOT NULL,

    manual_override
        BOOLEAN
        NOT NULL,

    rationale
        VARCHAR(3000)
        NOT NULL,

    decided_by_user_id
        UUID
        NOT NULL,

    decided_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_award_decision_rfq
        UNIQUE (
            rfq_id
        ),

    CONSTRAINT fk_award_decision_rfq
        FOREIGN KEY (
            rfq_id
        )
        REFERENCES rfqs (id),

    CONSTRAINT fk_award_selected_quotation
        FOREIGN KEY (
            selected_quotation_id
        )
        REFERENCES quotations (id),

    CONSTRAINT fk_award_recommended_quotation
        FOREIGN KEY (
            recommended_quotation_id
        )
        REFERENCES quotations (id),

    CONSTRAINT fk_award_decided_by
        FOREIGN KEY (
            decided_by_user_id
        )
        REFERENCES app_users (id)
);

CREATE INDEX idx_supplier_evaluations_rfq
    ON supplier_evaluations (
        rfq_id
    );

CREATE INDEX idx_supplier_evaluations_score
    ON supplier_evaluations (
        rfq_id,
        weighted_total_score DESC
    );

CREATE INDEX idx_award_decisions_selected
    ON award_decisions (
        selected_quotation_id
    );
