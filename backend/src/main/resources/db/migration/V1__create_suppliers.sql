CREATE TABLE suppliers (
    id UUID PRIMARY KEY,

    supplier_code VARCHAR(20) NOT NULL,

    legal_name VARCHAR(160) NOT NULL,

    trading_name VARCHAR(160),

    contact_email VARCHAR(200),

    phone VARCHAR(50),

    website VARCHAR(300),

    country VARCHAR(100) NOT NULL,

    city VARCHAR(100),

    category VARCHAR(120) NOT NULL,

    status VARCHAR(30) NOT NULL,

    risk_level VARCHAR(30) NOT NULL,

    rating NUMERIC(3, 2),

    on_time_delivery_rate NUMERIC(5, 2),

    total_spend NUMERIC(19, 2)
        NOT NULL DEFAULT 0,

    active BOOLEAN
        NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL,

    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT uk_suppliers_supplier_code
        UNIQUE (supplier_code),

    CONSTRAINT ck_suppliers_status
        CHECK (
            status IN (
                'ACTIVE',
                'ONBOARDING',
                'SUSPENDED',
                'INACTIVE'
            )
        ),

    CONSTRAINT ck_suppliers_risk_level
        CHECK (
            risk_level IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_suppliers_rating
        CHECK (
            rating IS NULL
            OR (
                rating >= 0
                AND rating <= 5
            )
        ),

    CONSTRAINT ck_suppliers_delivery_rate
        CHECK (
            on_time_delivery_rate IS NULL
            OR (
                on_time_delivery_rate >= 0
                AND on_time_delivery_rate <= 100
            )
        ),

    CONSTRAINT ck_suppliers_total_spend
        CHECK (
            total_spend >= 0
        )
);

CREATE INDEX idx_suppliers_legal_name
    ON suppliers (legal_name);

CREATE INDEX idx_suppliers_category
    ON suppliers (category);

CREATE INDEX idx_suppliers_status
    ON suppliers (status);

CREATE INDEX idx_suppliers_risk
    ON suppliers (risk_level);

CREATE INDEX idx_suppliers_active
    ON suppliers (active);
