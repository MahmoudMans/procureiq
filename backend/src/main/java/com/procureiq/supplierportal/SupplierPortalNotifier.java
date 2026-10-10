package com.procureiq.supplierportal;

import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Writes bell notifications for internal users when something happens on an RFQ in the
 * supplier portal.
 *
 * Recipients are the primary user (normally the RFQ owner) plus every active user holding one
 * of the team roles below, each notified once. To widen or narrow who is told, change
 * TEAM_ROLES.
 *
 * It is best-effort on purpose: a failed notification is logged and never undoes or blocks
 * the supplier's action, and a failure for one recipient does not stop the others. Each event
 * gets its own unique key, so repeated actions (submit, withdraw, submit again) each produce
 * a notification.
 */
@Component
public class SupplierPortalNotifier {

    private static final Logger log =
            LoggerFactory.getLogger(
                    SupplierPortalNotifier.class
            );

    /** Roles notified in addition to the RFQ owner. */
    private static final Set<ProcurementRole> TEAM_ROLES =
            EnumSet.of(
                    ProcurementRole.PROCUREMENT_MANAGER
            );

    private final JdbcTemplate jdbcTemplate;

    private final AppUserRepository appUserRepository;

    public SupplierPortalNotifier(
            JdbcTemplate jdbcTemplate,
            AppUserRepository appUserRepository
    ) {
        this.jdbcTemplate =
                jdbcTemplate;

        this.appUserRepository =
                appUserRepository;
    }

    public void notifyRfqTeam(
            UUID primaryRecipientId,
            UUID rfqId,
            String type,
            String severity,
            String title,
            String message
    ) {
        Set<UUID> recipients =
                new LinkedHashSet<>();

        if (primaryRecipientId != null) {
            recipients.add(
                    primaryRecipientId
            );
        }

        try {
            appUserRepository
                    .findAllByOrderByFullNameAsc()
                    .stream()
                    .filter(
                            AppUserEntity::isActive
                    )
                    .filter(
                            user ->
                                    TEAM_ROLES.contains(
                                            user.getRole()
                                    )
                    )
                    .map(
                            AppUserEntity::getId
                    )
                    .forEach(
                            recipients::add
                    );
        } catch (
                RuntimeException exception
        ) {
            log.warn(
                    "Could not look up the sourcing team for RFQ {}; notifying the RFQ owner only: {}",
                    rfqId,
                    exception.toString()
            );
        }

        for (
                UUID recipient
                : recipients
        ) {
            insert(
                    recipient,
                    rfqId,
                    type,
                    severity,
                    title,
                    message
            );
        }
    }

    private void insert(
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

    /**
     * Same recipients as notifyRfqTeam, for an event on a purchase order. The notification is
     * filed under the RFQ the order came from, like the other supplier events, and links to
     * the purchase order. Best-effort: a failure is logged and never reaches the supplier.
     */
    public void notifyPurchaseOrderTeam(
            UUID primaryRecipientId,
            UUID rfqId,
            UUID purchaseOrderId,
            String type,
            String severity,
            String title,
            String message
    ) {
        Set<UUID> recipients =
                new LinkedHashSet<>();

        if (primaryRecipientId != null) {
            recipients.add(
                    primaryRecipientId
            );
        }

        try {
            appUserRepository
                    .findAllByOrderByFullNameAsc()
                    .stream()
                    .filter(
                            AppUserEntity::isActive
                    )
                    .filter(
                            user ->
                                    TEAM_ROLES.contains(
                                            user.getRole()
                                    )
                    )
                    .map(
                            AppUserEntity::getId
                    )
                    .forEach(
                            recipients::add
                    );
        } catch (
                RuntimeException exception
        ) {
            log.warn(
                    "Could not look up the sourcing team for purchase order {}; notifying the owner only: {}",
                    purchaseOrderId,
                    exception.toString()
            );
        }

        for (
                UUID recipient
                : recipients
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
                        recipient,
                        type
                                + ":"
                                + purchaseOrderId
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
                        "/purchase-orders/"
                                + purchaseOrderId
                );
            } catch (
                    RuntimeException exception
            ) {
                log.warn(
                        "Could not create the {} notification for user {} on purchase order {}: {}",
                        type,
                        recipient,
                        purchaseOrderId,
                        exception.toString()
                );
            }
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
