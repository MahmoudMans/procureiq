package com.procureiq.supplierportal;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Queries for supplier self-service on RFQs. Every query is scoped by the supplier
 * taken from a valid portal session.
 */
@Repository
public class SupplierPortalRfqRepository {

    private final JdbcTemplate jdbcTemplate;

    public SupplierPortalRfqRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public record PortalSession(
            UUID sessionId,
            UUID accountId,
            UUID supplierId,
            String displayName,
            String email,
            UUID invitedByUserId
    ) {
    }

    public record InvitedRfq(
            UUID rfqId,
            UUID ownerUserId,
            UUID quotationId,
            String quotationNumber,
            String quotationStatus,
            BigDecimal quotationTotal,
            Instant quotationSubmittedAt
    ) {
    }

    public record QuotationRef(
            UUID id,
            String status
    ) {
    }

    public PortalSession findActiveSession(
            String tokenHash
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    s.id AS session_id,
                    a.id AS account_id,
                    a.supplier_id,
                    a.display_name,
                    a.email,
                    a.created_by_user_id
                FROM supplier_portal_sessions s
                JOIN supplier_portal_accounts a
                    ON a.id = s.account_id
                WHERE s.token_hash = ?
                AND s.revoked_at IS NULL
                AND s.expires_at > CURRENT_TIMESTAMP
                AND a.status = 'ACTIVE'
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new PortalSession(
                                resultSet.getObject(
                                        "session_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "account_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "supplier_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "display_name"
                                ),
                                resultSet.getString(
                                        "email"
                                ),
                                resultSet.getObject(
                                        "created_by_user_id",
                                        UUID.class
                                )
                        ),
                tokenHash
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void touchSession(
            UUID sessionId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_portal_sessions
                SET last_seen_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                sessionId
        );
    }

    public void writeAudit(
            UUID accountId,
            UUID supplierId,
            String eventType,
            String details
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_portal_audit_events (
                    id,
                    account_id,
                    supplier_id,
                    event_type,
                    details,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                UUID.randomUUID(),
                accountId,
                supplierId,
                eventType,
                details
        );
    }

    /** RFQs the supplier was invited to, never drafts, with its own quotation if any. */
    public List<InvitedRfq> findInvitedRfqs(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    r.id AS rfq_id,
                    r.created_by_user_id AS owner_user_id,
                    q.id AS quotation_id,
                    q.quotation_number,
                    q.status AS quotation_status,
                    q.total_amount AS quotation_total,
                    q.submitted_at AS quotation_submitted_at
                FROM rfq_supplier_invitations i
                JOIN rfqs r
                    ON r.id = i.rfq_id
                LEFT JOIN quotations q
                    ON q.rfq_id = r.id
                    AND q.supplier_id = i.supplier_id
                WHERE i.supplier_id = ?
                AND r.status <> 'DRAFT'
                ORDER BY r.updated_at DESC
                LIMIT 50
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new InvitedRfq(
                                resultSet.getObject(
                                        "rfq_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "owner_user_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "quotation_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "quotation_number"
                                ),
                                resultSet.getString(
                                        "quotation_status"
                                ),
                                resultSet.getBigDecimal(
                                        "quotation_total"
                                ),
                                instant(
                                        resultSet,
                                        "quotation_submitted_at"
                                )
                        ),
                supplierId
        );
    }

    /** The RFQ owner when this supplier is invited to a non-draft RFQ, otherwise null. */
    public UUID findInvitedRfqOwner(
            UUID supplierId,
            UUID rfqId
    ) {
        return jdbcTemplate.query(
                """
                SELECT r.created_by_user_id
                FROM rfq_supplier_invitations i
                JOIN rfqs r
                    ON r.id = i.rfq_id
                WHERE i.rfq_id = ?
                AND i.supplier_id = ?
                AND r.status <> 'DRAFT'
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        resultSet.getObject(
                                1,
                                UUID.class
                        ),
                rfqId,
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public String findSupplierStatus(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                SELECT status
                FROM suppliers
                WHERE id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        resultSet.getString(
                                1
                        ),
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public QuotationRef findQuotationRef(
            UUID rfqId,
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                SELECT id, status
                FROM quotations
                WHERE rfq_id = ?
                AND supplier_id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new QuotationRef(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "status"
                                )
                        ),
                rfqId,
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    /**
     * A withdrawn quotation is kept (one quotation per supplier and RFQ), so a supplier who
     * withdrew to revise it needs it turned back into a draft.
     */
    public int reopenWithdrawnQuotation(
            UUID quotationId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE quotations
                SET status = 'DRAFT',
                    withdrawn_at = NULL,
                    submitted_at = NULL,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1
                WHERE id = ?
                AND status = 'WITHDRAWN'
                """,
                quotationId
        );
    }

    private static Instant instant(
            ResultSet resultSet,
            String column
    ) throws SQLException {
        Timestamp timestamp =
                resultSet.getTimestamp(
                        column
                );

        return timestamp == null
                ? null
                : timestamp.toInstant();
    }
}
