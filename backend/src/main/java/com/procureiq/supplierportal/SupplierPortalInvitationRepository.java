package com.procureiq.supplierportal;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Changes an RFQ invitation between INVITED and DECLINED. Both updates are conditional, so a
 * stale screen or a double click cannot move an invitation into the wrong state.
 */
@Repository
public class SupplierPortalInvitationRepository {

    private final JdbcTemplate jdbcTemplate;

    public SupplierPortalInvitationRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    /** Declines an invitation that is still open and has no submitted quotation. */
    public int decline(
            UUID rfqId,
            UUID supplierId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE rfq_supplier_invitations i
                SET status = 'DECLINED',
                    responded_at = CURRENT_TIMESTAMP
                WHERE i.rfq_id = ?
                AND i.supplier_id = ?
                AND i.status = 'INVITED'
                AND EXISTS (
                    SELECT 1
                    FROM rfqs r
                    WHERE r.id = i.rfq_id
                    AND r.status = 'PUBLISHED'
                )
                AND NOT EXISTS (
                    SELECT 1
                    FROM quotations q
                    WHERE q.rfq_id = i.rfq_id
                    AND q.supplier_id = i.supplier_id
                    AND q.status = 'SUBMITTED'
                )
                """,
                rfqId,
                supplierId
        );
    }

    /** Puts a declined invitation back to INVITED while the RFQ is still published. */
    public int reconsider(
            UUID rfqId,
            UUID supplierId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE rfq_supplier_invitations i
                SET status = 'INVITED',
                    responded_at = NULL
                WHERE i.rfq_id = ?
                AND i.supplier_id = ?
                AND i.status = 'DECLINED'
                AND EXISTS (
                    SELECT 1
                    FROM rfqs r
                    WHERE r.id = i.rfq_id
                    AND r.status = 'PUBLISHED'
                )
                """,
                rfqId,
                supplierId
        );
    }
}
