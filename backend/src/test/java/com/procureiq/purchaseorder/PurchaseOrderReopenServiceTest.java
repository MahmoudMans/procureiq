package com.procureiq.purchaseorder;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procureiq.evaluation.AwardDecisionRepository;
import com.procureiq.rfq.RfqRepository;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PurchaseOrderReopenServiceTest {

    private final PurchaseOrderRepository orders =
            mock(PurchaseOrderRepository.class);

    private final AppUserRepository users =
            mock(AppUserRepository.class);

    private final PurchaseOrderService service =
            new PurchaseOrderService(
                    orders,
                    mock(RfqRepository.class),
                    mock(AwardDecisionRepository.class),
                    users
            );

    private final UUID userId = UUID.randomUUID();
    private final UUID orderId = UUID.randomUUID();

    private void signIn(ProcurementRole role) {
        AppUserEntity user = mock(AppUserEntity.class);

        when(user.isActive()).thenReturn(true);
        when(user.getRole()).thenReturn(role);
        when(users.findById(userId)).thenReturn(Optional.of(user));
    }

    private void order(PurchaseOrderStatus status, String supplierResponse) {
        PurchaseOrderEntity order = mock(PurchaseOrderEntity.class);

        when(order.getId()).thenReturn(orderId);
        when(order.getStatus()).thenReturn(status);
        when(order.getSupplierResponse()).thenReturn(supplierResponse);
        when(orders.findById(orderId)).thenReturn(Optional.of(order));
    }

    @Test
    void aDraftOrderCannotBeReopened() {
        signIn(ProcurementRole.BUYER);
        order(PurchaseOrderStatus.DRAFT, "PENDING");

        assertThrows(
                IllegalArgumentException.class,
                () -> service.reopenOrder(userId, orderId)
        );

        verify(orders, never()).reopenRejected(any());
    }

    @Test
    void anOrderStillWaitingForTheSupplierCannotBeReopened() {
        signIn(ProcurementRole.BUYER);
        order(PurchaseOrderStatus.ISSUED, "PENDING");

        assertThrows(
                IllegalArgumentException.class,
                () -> service.reopenOrder(userId, orderId)
        );

        verify(orders, never()).reopenRejected(any());
    }

    @Test
    void anOrderTheSupplierAcknowledgedCannotBeReopened() {
        signIn(ProcurementRole.BUYER);
        order(PurchaseOrderStatus.ISSUED, "ACKNOWLEDGED");

        assertThrows(
                IllegalArgumentException.class,
                () -> service.reopenOrder(userId, orderId)
        );

        verify(orders, never()).reopenRejected(any());
    }

    @Test
    void goodsAlreadyReceivedBlocksTheReopen() {
        signIn(ProcurementRole.BUYER);
        order(PurchaseOrderStatus.ISSUED, "REJECTED");
        when(orders.reopenRejected(orderId)).thenReturn(0);

        assertThrows(
                IllegalArgumentException.class,
                () -> service.reopenOrder(userId, orderId)
        );
    }

    @Test
    void aRoleThatCannotManageOrdersIsRefusedBeforeAnythingIsRead() {
        signIn(ProcurementRole.APPROVER);

        assertThrows(
                IllegalArgumentException.class,
                () -> service.reopenOrder(userId, orderId)
        );

        verify(orders, never()).findById(any());
        verify(orders, never()).reopenRejected(any());
    }
}
