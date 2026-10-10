package com.procureiq.supplierportal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SupplierPortalPurchaseOrderServiceTest {

    private final SupplierPortalPurchaseOrderRepository orders =
            mock(SupplierPortalPurchaseOrderRepository.class);

    private final SupplierPortalRepository sessions =
            mock(SupplierPortalRepository.class);

    private final SupplierPortalSecurityService security =
            mock(SupplierPortalSecurityService.class);

    private final SupplierPortalNotifier notifier =
            mock(SupplierPortalNotifier.class);

    private final SupplierPortalPurchaseOrderService service =
            new SupplierPortalPurchaseOrderService(
                    orders,
                    sessions,
                    security,
                    notifier
            );

    private final UUID supplierId = UUID.randomUUID();
    private final UUID accountId = UUID.randomUUID();
    private final UUID orderId = UUID.randomUUID();
    private final UUID rfqId = UUID.randomUUID();
    private final UUID ownerId = UUID.randomUUID();

    @BeforeEach
    void signedIn() {
        when(security.hashToken("token")).thenReturn("hash");
        when(sessions.findActiveSession("hash")).thenReturn(session());
    }

    @Test
    void anUnknownSessionIsRejected() {
        when(sessions.findActiveSession("hash")).thenReturn(null);

        assertThrows(
                IllegalArgumentException.class,
                () -> service.purchaseOrders("token")
        );
    }

    @Test
    void anotherSuppliersOrderIsNotFoundAndNothingIsChanged() {
        assertThrows(
                RuntimeException.class,
                () -> service.acknowledge("token", orderId, null)
        );

        verify(orders, never()).respond(any(), any(), any(), any(), any());
        verify(notifier, never()).notifyPurchaseOrderTeam(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void rejectingNeedsAReason() {
        when(orders.findIssuedForSupplier(supplierId, orderId))
                .thenReturn(order("ISSUED", "PENDING"));

        assertThrows(
                IllegalArgumentException.class,
                () -> service.reject("token", orderId, "   ")
        );

        verify(orders, never()).respond(any(), any(), any(), any(), any());
    }

    @Test
    void anOrderAlreadyAnsweredCannotBeAnsweredAgain() {
        when(orders.findIssuedForSupplier(supplierId, orderId))
                .thenReturn(order("ISSUED", "ACKNOWLEDGED"));

        assertThrows(
                IllegalArgumentException.class,
                () -> service.reject("token", orderId, "Too late")
        );

        verify(orders, never()).respond(any(), any(), any(), any(), any());
    }

    @Test
    void aCancelledOrderCannotBeAnswered() {
        when(orders.findIssuedForSupplier(supplierId, orderId))
                .thenReturn(order("CANCELLED", "PENDING"));

        assertThrows(
                IllegalArgumentException.class,
                () -> service.acknowledge("token", orderId, null)
        );

        verify(orders, never()).respond(any(), any(), any(), any(), any());
    }

    @Test
    void aLostRaceIsReportedAndNobodyIsNotified() {
        when(orders.findIssuedForSupplier(supplierId, orderId))
                .thenReturn(order("ISSUED", "PENDING"));
        when(orders.respond(orderId, supplierId, accountId, "ACKNOWLEDGED", null))
                .thenReturn(0);

        assertThrows(
                IllegalArgumentException.class,
                () -> service.acknowledge("token", orderId, null)
        );

        verify(notifier, never()).notifyPurchaseOrderTeam(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void acknowledgingRecordsTheAnswerAndNotifiesTheOwner() {
        when(orders.findIssuedForSupplier(supplierId, orderId))
                .thenReturn(
                        order("ISSUED", "PENDING"),
                        order("ISSUED", "ACKNOWLEDGED")
                );
        when(orders.respond(orderId, supplierId, accountId, "ACKNOWLEDGED", "Will ship Monday"))
                .thenReturn(1);

        SupplierPortalPurchaseOrderDetailResponse result =
                service.acknowledge("token", orderId, "  Will ship Monday  ");

        assertEquals("ACKNOWLEDGED", result.supplierResponse());

        verify(orders).respond(
                eq(orderId),
                eq(supplierId),
                eq(accountId),
                eq("ACKNOWLEDGED"),
                eq("Will ship Monday")
        );
        verify(notifier).notifyPurchaseOrderTeam(
                eq(ownerId),
                eq(rfqId),
                eq(orderId),
                eq("SUPPLIER_PO_ACKNOWLEDGED"),
                any(),
                any(),
                any()
        );
    }

    @Test
    void aFailedNotificationDoesNotUndoTheAnswer() {
        when(orders.findIssuedForSupplier(supplierId, orderId))
                .thenReturn(
                        order("ISSUED", "PENDING"),
                        order("ISSUED", "REJECTED")
                );
        when(orders.respond(orderId, supplierId, accountId, "REJECTED", "Wrong price"))
                .thenReturn(1);
        doThrow(new RuntimeException("boom"))
                .when(notifier)
                .notifyPurchaseOrderTeam(any(), any(), any(), any(), any(), any(), any());

        SupplierPortalPurchaseOrderDetailResponse result =
                service.reject("token", orderId, "Wrong price");

        assertEquals("REJECTED", result.supplierResponse());
    }

    private SupplierPortalRepository.SessionRow session() {
        return new SupplierPortalRepository.SessionRow(
                UUID.randomUUID(),
                accountId,
                supplierId,
                "SUP-1",
                "Acme Supplies",
                "ann@acme.test",
                "Ann",
                null,
                Instant.now().plusSeconds(3600),
                Instant.now(),
                Instant.now()
        );
    }

    private SupplierPortalPurchaseOrderRepository.OrderRow order(
            String status,
            String response
    ) {
        return new SupplierPortalPurchaseOrderRepository.OrderRow(
                orderId,
                "PO-2026-00001",
                rfqId,
                "RFQ-2026-00001",
                "Q-2026-00001",
                ownerId,
                "EUR",
                "30 days net",
                LocalDate.of(2026, 12, 1),
                "1 Test Street",
                BigDecimal.TEN,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.TEN,
                status,
                response,
                null,
                null,
                Instant.now(),
                null
        );
    }
}
