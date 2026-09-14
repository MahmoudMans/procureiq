package com.procureiq.suppliercollaboration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SupplierCollaborationPolicyServiceTest {

    private SupplierCollaborationPolicyService service;

    @BeforeEach
    void setUp() {
        service =
                new SupplierCollaborationPolicyService();
    }

    @Test
    void shouldUseTwentyFourHoursForMediumPriorityPurchaseOrder() {
        assertEquals(
                24,
                service.defaultSupplierResponseSlaHours(
                        CollaborationWorkspaceType.PURCHASE_ORDER,
                        CollaborationPriority.MEDIUM
                )
        );
    }

    @Test
    void shouldShortenCriticalDeliveryResponseSla() {
        assertEquals(
                6,
                service.defaultSupplierResponseSlaHours(
                        CollaborationWorkspaceType.DELIVERY,
                        CollaborationPriority.CRITICAL
                )
        );
    }

    @Test
    void shouldAllowLongerLowPriorityDocumentRequest() {
        assertEquals(
                144,
                service.defaultSupplierResponseSlaHours(
                        CollaborationWorkspaceType.DOCUMENT_REQUEST,
                        CollaborationPriority.LOW
                )
        );
    }
}
