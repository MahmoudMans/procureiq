package com.procureiq.supplierportal;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Writes a bell notification for an internal user when something happens on an RFQ in the
 * supplier portal.
 *
 * It is best-effort on purpose: a failed notification is logged and never undoes or blocks
 * the supplier's action. Each event gets its own unique key, so repeated actions (submit,
 * withdraw, submit again) each produce a notification.
 */
@Component
public class SupplierPortalNotifier {

    private static final Logger log =
            LoggerFactory.getLogger(
                    SupplierPortalNotifier.class
            );

    private final JdbcTemplate jdbcTemplate;

    public SupplierPortalNotifier(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public void notifyRfqOwner(
            UUID recipientUserId,
            UUID rfqId,
            String type,
            String severity,
            String title,
            String message
    ) {
        try {
            jdbcTemplate.update(
                    """
                    INSERT INTO user_notifications (
                        user_id,
                        notification_key,
                        notification_type,
                        severity,
                        title,
                        message,
                        entity_type,
                        entity_id,
                        href
                    )
                    VALUES (?, ?, ?, ?, ?, ?, 'RFQ', ?, ?)
                    ON CONFLICT (
                        user_id,
                        notification_key
                    )
                    DO NOTHING
                    """,
                    recipientUserId,
                    type
                            + ":"
                            + rfqId
                            + ":"
                            + UUID.randomUUID(),
                    type,
                    severity,
                    abbreviate(
                            title,
                            200
                    ),
                    abbreviate(
                            message,
                            1000
                    ),
                    rfqId,
                    "/rfqs/"
                            + rfqId
            );
        } catch (
                RuntimeException exception
        ) {
            log.warn(
                    "Could not create the {} notification for user {} on RFQ {}: {}",
                    type,
                    recipientUserId,
                    rfqId,
                    exception.toString()
            );
        }
    }

    private static String abbreviate(
            String text,
            int max
    ) {
        if (
                text == null
                ||
                text.length() <= max
        ) {
            return text;
        }

        return text.substring(
                0,
                max - 1
        )
                + "…";
    }
}
