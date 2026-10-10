package com.procureiq.supplierportal;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Finds RFQs a supplier was invited to that have since closed, been cancelled or been
 * awarded. Updates are worked out from the RFQ's current state, so nothing has to be written
 * when procurement closes or awards an RFQ.
 *
 * Only a yes/no "awarded to this supplier" is read from the award; the winner's identity is
 * never selected.
 */
@Repository
public class SupplierPortalUpdateRepository {

    private final JdbcTemplate jdbcTemplate;

    public SupplierPortalUpdateRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public List<UpdateRow> findRecent(
            UUID supplierId,
            int days,
            int limit
    ) {
        return jdbcTemplate.query(
                """
                SELECT *
                FROM (
                    SELECT
                        r.id AS rfq_id,
                        r.rfq_number,
                        r.title,
                        r.status AS rfq_status,
                        COALESCE(
                            selected_quotation.supplier_id
                                = i.supplier_id,
                            FALSE
                        ) AS awarded_to_you,
                        COALESCE(
                            own_quotation.status
                                = 'SUBMITTED',
                            FALSE
                        ) AS quotation_submitted,
                        own_quotation.quotation_number,
                        CASE r.status
                            WHEN 'AWARDED'
                                THEN COALESCE(
                                    award_decision.decided_at,
                                    r.closed_at,
                                    r.updated_at
                                )
                            WHEN 'CANCELLED'
                                THEN COALESCE(
                                    r.cancelled_at,
                                    r.updated_at
                                )
                            ELSE COALESCE(
                                r.closed_at,
                                r.updated_at
                            )
                        END AS event_at
                    FROM rfq_supplier_invitations i
                    JOIN rfqs r
                        ON r.id = i.rfq_id
                    LEFT JOIN award_decisions award_decision
                        ON award_decision.rfq_id = r.id
                    LEFT JOIN quotations selected_quotation
                        ON selected_quotation.id =
                           award_decision.selected_quotation_id
                    LEFT JOIN quotations own_quotation
                        ON own_quotation.rfq_id = r.id
                       AND own_quotation.supplier_id =
                           i.supplier_id
                    WHERE i.supplier_id = ?
                    AND i.status <> 'DECLINED'
                    AND r.status IN (
                        'CLOSED',
                        'CANCELLED',
                        'AWARDED'
                    )
                ) outcome
                WHERE outcome.event_at >=
                    CURRENT_TIMESTAMP
                    - make_interval(days => ?)
                ORDER BY outcome.event_at DESC
                LIMIT ?
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp eventAt =
                            resultSet.getTimestamp(
                                    "event_at"
                            );

                    return new UpdateRow(
                            resultSet.getObject(
                                    "rfq_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "rfq_number"
                            ),
                            resultSet.getString(
                                    "title"
                            ),
                            resultSet.getString(
                                    "rfq_status"
                            ),
                            resultSet.getBoolean(
                                    "awarded_to_you"
                            ),
                            resultSet.getBoolean(
                                    "quotation_submitted"
                            ),
                            resultSet.getString(
                                    "quotation_number"
                            ),
                            eventAt == null
                                    ? null
                                    : eventAt.toInstant()
                    );
                },
                supplierId,
                days,
                limit
        );
    }

    public record UpdateRow(
            UUID rfqId,
            String rfqNumber,
            String title,
            String rfqStatus,
            boolean awardedToYou,
            boolean quotationSubmitted,
            String quotationNumber,
            Instant occurredAt
    ) {
    }
}
