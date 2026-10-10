-- The supplier's answer to an issued purchase order. PENDING until the supplier acknowledges or
-- rejects it in the portal. A rejection does not change the order's own status: the buyer
-- decides what happens next. supplier_responded_by_account_id is the portal account that
-- answered (deliberately without a foreign key, so removing an account never blocks an order).
ALTER TABLE purchase_orders
    ADD COLUMN supplier_response VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN supplier_responded_at TIMESTAMPTZ,
    ADD COLUMN supplier_response_note VARCHAR(1000),
    ADD COLUMN supplier_responded_by_account_id UUID,
    ADD CONSTRAINT ck_purchase_orders_supplier_response
        CHECK (
            supplier_response IN (
                'PENDING',
                'ACKNOWLEDGED',
                'REJECTED'
            )
        );
