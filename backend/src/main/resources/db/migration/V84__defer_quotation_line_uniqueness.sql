-- Replacing a quotation's lines inserts the new rows before the removed ones are deleted
-- (Hibernate flushes inserts before orphan deletes). By commit time both rules below hold
-- again, so they must be checked at commit instead of row by row. Without this, editing any
-- quotation that already has lines fails with a unique violation (HTTP 409).
ALTER TABLE quotation_lines
    DROP CONSTRAINT uk_quotation_line_number,
    DROP CONSTRAINT uk_quotation_rfq_line,
    ADD CONSTRAINT uk_quotation_line_number
        UNIQUE (
            quotation_id,
            line_number
        )
        DEFERRABLE INITIALLY DEFERRED,
    ADD CONSTRAINT uk_quotation_rfq_line
        UNIQUE (
            quotation_id,
            rfq_line_item_id
        )
        DEFERRABLE INITIALLY DEFERRED;
