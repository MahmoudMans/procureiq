package com.procureiq.supplierportal;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.supplierportal.SupplierPortalPurchaseOrderRepository.OrderRow;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Lets a supplier see the purchase orders issued to it and acknowledge or reject them.
 *
 * Like the rest of the portal, access is decided by the portal session token. A supplier only
 * ever sees its own issued orders; anything else is reported as not found, so one supplier can
 * never learn that another supplier's order exists.
 *
 * A rejection does not change the order's own status. It records the reason and tells the
 * buyer team, who decide what happens next. The buyer notification is best-effort: a failure
 * is logged and never undoes the supplier's answer.
 */
@Service
public class SupplierPortalPurchaseOrderService {

    private static final Logger log =
            LoggerFactory.getLogger(
                    SupplierPortalPurchaseOrderService.class
            );

    private static final String NOT_AVAILABLE =
            "This purchase order was not found or is not available to your account.";

    private static final String ACKNOWLEDGED =
            "ACKNOWLEDGED";

    private static final String REJECTED =
            "REJECTED";

    private static final String ACKNOWLEDGED_TYPE =
            "SUPPLIER_PO_ACKNOWLEDGED";

    private static final String REJECTED_TYPE =
            "SUPPLIER_PO_REJECTED";

    // Reused from the RFQ events, so they are known to be accepted by the database.
    private static final String ACKNOWLEDGED_SEVERITY =
            "INFO";

    private static final String REJECTED_SEVERITY =
            "WARNING";

    private final SupplierPortalPurchaseOrderRepository orders;

    private final SupplierPortalRepository sessions;

    private final SupplierPortalSecurityService securityService;

    private final SupplierPortalNotifier notifier;

    public SupplierPortalPurchaseOrderService(
            SupplierPortalPurchaseOrderRepository orders,
            SupplierPortalRepository sessions,
            SupplierPortalSecurityService securityService,
            SupplierPortalNotifier notifier
    ) {
        this.orders =
                orders;

        this.sessions =
                sessions;

        this.securityService =
                securityService;

        this.notifier =
                notifier;
    }

    public List<SupplierPortalPurchaseOrderSummaryResponse> purchaseOrders(
            String rawToken
    ) {
        SupplierPortalRepository.SessionRow session =
                requireSession(
                        rawToken
                );

        return orders
                .findIssuedForSupplier(
                        session.supplierId()
                )
                .stream()
                .map(
                        this::summary
                )
                .toList();
    }

    public SupplierPortalPurchaseOrderDetailResponse purchaseOrder(
            String rawToken,
            UUID purchaseOrderId
    ) {
        SupplierPortalRepository.SessionRow session =
                requireSession(
                        rawToken
                );

        return detail(
                requireOrder(
                        session.supplierId(),
                        purchaseOrderId
                )
        );
    }

    public SupplierPortalPurchaseOrderDetailResponse acknowledge(
            String rawToken,
            UUID purchaseOrderId,
            String note
    ) {
        return respond(
                rawToken,
                purchaseOrderId,
                ACKNOWLEDGED,
                normalizeNote(
                        note
                ),
                false
        );
    }

    public SupplierPortalPurchaseOrderDetailResponse reject(
            String rawToken,
            UUID purchaseOrderId,
            String reason
    ) {
        return respond(
                rawToken,
                purchaseOrderId,
                REJECTED,
                normalizeNote(
                        reason
                ),
                true
        );
    }

    private SupplierPortalPurchaseOrderDetailResponse respond(
            String rawToken,
            UUID purchaseOrderId,
            String response,
            String note,
            boolean noteRequired
    ) {
        SupplierPortalRepository.SessionRow session =
                requireSession(
                        rawToken
                );

        OrderRow order =
                requireOrder(
                        session.supplierId(),
                        purchaseOrderId
                );

        if (
                noteRequired
                &&
                note == null
        ) {
            throw new IllegalArgumentException(
                    "Tell the buyer why you are rejecting this purchase order."
            );
        }

        if (
                !"ISSUED".equals(
                        order.status()
                )
        ) {
            throw new IllegalArgumentException(
                    "This purchase order is no longer open for a response."
            );
        }

        if (
                !"PENDING".equals(
                        order.supplierResponse()
                )
        ) {
            throw new IllegalArgumentException(
                    "You have already responded to this purchase order."
            );
        }

        if (
                orders.respond(
                        purchaseOrderId,
                        session.supplierId(),
                        session.accountId(),
                        response,
                        note
                )
                == 0
        ) {
            throw new IllegalArgumentException(
                    "This purchase order can no longer be updated. Reload it and try again."
            );
        }

        notifyBuyers(
                order,
                session,
                response,
                note
        );

        return detail(
                requireOrder(
                        session.supplierId(),
                        purchaseOrderId
                )
        );
    }

    private void notifyBuyers(
            OrderRow order,
            SupplierPortalRepository.SessionRow session,
            String response,
            String note
    ) {
        boolean acknowledged =
                ACKNOWLEDGED.equals(
                        response
                );

        try {
            notifier.notifyPurchaseOrderTeam(
                    order.ownerUserId(),
                    order.rfqId(),
                    order.id(),
                    acknowledged
                            ? ACKNOWLEDGED_TYPE
                            : REJECTED_TYPE,
                    acknowledged
                            ? ACKNOWLEDGED_SEVERITY
                            : REJECTED_SEVERITY,
                    acknowledged
                            ? "Supplier acknowledged purchase order"
                            : "Supplier rejected purchase order",
                    session.supplierName()
                            + (
                            acknowledged
                                    ? " acknowledged purchase order "
                                    : " rejected purchase order "
                    )
                            + order.poNumber()
                            + (
                            note == null
                                    ? "."
                                    : ": "
                                    + note
                    )
            );
        } catch (
                RuntimeException exception
        ) {
            log.warn(
                    "Could not notify the buyer team about purchase order {}: {}",
                    order.id(),
                    exception.toString()
            );
        }
    }

    private OrderRow requireOrder(
            UUID supplierId,
            UUID purchaseOrderId
    ) {
        OrderRow row =
                orders.findIssuedForSupplier(
                        supplierId,
                        purchaseOrderId
                );

        if (row == null) {
            throw new ResourceNotFoundException(
                    NOT_AVAILABLE
            );
        }

        return row;
    }

    private SupplierPortalRepository.SessionRow requireSession(
            String rawToken
    ) {
        SupplierPortalRepository.SessionRow session =
                sessions.findActiveSession(
                        securityService.hashToken(
                                rawToken
                        )
                );

        if (session == null) {
            throw new IllegalArgumentException(
                    "Supplier portal session is invalid or expired."
            );
        }

        return session;
    }

    private SupplierPortalPurchaseOrderSummaryResponse summary(
            OrderRow row
    ) {
        return new SupplierPortalPurchaseOrderSummaryResponse(
                row.id(),
                row.poNumber(),
                row.rfqId(),
                row.rfqNumber(),
                row.currency(),
                row.totalAmount(),
                row.expectedDeliveryDate(),
                row.status(),
                row.supplierResponse(),
                row.supplierRespondedAt(),
                row.issuedAt()
        );
    }

    private SupplierPortalPurchaseOrderDetailResponse detail(
            OrderRow row
    ) {
        List<SupplierPortalPurchaseOrderLineResponse> lines =
                orders
                        .lines(
                                row.id()
                        )
                        .stream()
                        .map(
                                line ->
                                        new SupplierPortalPurchaseOrderLineResponse(
                                                line.lineNumber(),
                                                line.itemName(),
                                                line.description(),
                                                line.category(),
                                                line.quantity(),
                                                line.unit(),
                                                line.unitPrice(),
                                                line.lineTotal()
                                        )
                        )
                        .toList();

        return new SupplierPortalPurchaseOrderDetailResponse(
                row.id(),
                row.poNumber(),
                row.rfqId(),
                row.rfqNumber(),
                row.quotationNumber(),
                row.currency(),
                row.paymentTerms(),
                row.expectedDeliveryDate(),
                row.deliveryAddress(),
                row.subtotal(),
                row.discountAmount(),
                row.shippingAmount(),
                row.taxAmount(),
                row.totalAmount(),
                row.status(),
                row.supplierResponse(),
                row.supplierRespondedAt(),
                row.supplierResponseNote(),
                row.issuedAt(),
                row.cancelledAt(),
                lines
        );
    }

    private static String normalizeNote(
            String note
    ) {
        if (note == null) {
            return null;
        }

        String trimmed =
                note.trim();

        return trimmed.isEmpty()
                ? null
                : trimmed;
    }
}
