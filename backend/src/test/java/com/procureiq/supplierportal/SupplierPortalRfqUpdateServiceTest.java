package com.procureiq.supplierportal;

import com.procureiq.supplierportal.SupplierPortalUpdateRepository.UpdateRow;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SupplierPortalRfqUpdateServiceTest {

    private SupplierPortalRfqRepository sessionRepository;

    private SupplierPortalUpdateRepository updateRepository;

    private SupplierPortalRfqUpdateService service;

    private UUID supplierId;

    @BeforeEach
    void setUp() {
        sessionRepository =
                mock(
                        SupplierPortalRfqRepository.class
                );

        updateRepository =
                mock(
                        SupplierPortalUpdateRepository.class
                );

        SupplierPortalSecurityService securityService =
                mock(
                        SupplierPortalSecurityService.class
                );

        service =
                new SupplierPortalRfqUpdateService(
                        sessionRepository,
                        updateRepository,
                        securityService
                );

        supplierId =
                UUID.randomUUID();

        SupplierPortalRfqRepository.PortalSession session =
                new SupplierPortalRfqRepository.PortalSession(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        supplierId,
                        "Sam Supplier",
                        "sam@supplier.test",
                        UUID.randomUUID()
                );

        when(
                sessionRepository.findActiveSession(
                        any()
                )
        ).thenReturn(
                session
        );
    }

    private SupplierPortalRfqUpdateResponse single(
            String rfqStatus,
            boolean awardedToYou,
            boolean quotationSubmitted,
            String quotationNumber
    ) {
        UpdateRow row =
                new UpdateRow(
                        UUID.randomUUID(),
                        "RFQ-2026-00007",
                        "Office chairs",
                        rfqStatus,
                        awardedToYou,
                        quotationSubmitted,
                        quotationNumber,
                        Instant.now()
                );

        when(
                updateRepository.findRecent(
                        any(),
                        anyInt(),
                        anyInt()
                )
        ).thenReturn(
                List.of(
                        row
                )
        );

        List<SupplierPortalRfqUpdateResponse> result =
                service.updates(
                        "token"
                );

        assertEquals(
                1,
                result.size()
        );

        return result.get(
                0
        );
    }

    @Test
    void theWinnerIsToldItWasAwarded() {
        SupplierPortalRfqUpdateResponse update =
                single(
                        "AWARDED",
                        true,
                        true,
                        "QUO-2026-00012"
                );

        assertEquals(
                "AWARDED_TO_YOU",
                update.kind()
        );

        assertTrue(
                update.message()
                        .contains(
                                "QUO-2026-00012"
                        )
        );
    }

    @Test
    void anUnsuccessfulSupplierOnlyLearnsThatADecisionWasMade() {
        SupplierPortalRfqUpdateResponse update =
                single(
                        "AWARDED",
                        false,
                        true,
                        "QUO-2026-00013"
                );

        assertEquals(
                "DECISION_MADE",
                update.kind()
        );

        assertEquals(
                "A decision has been made",
                update.headline()
        );

        assertTrue(
                !update.message()
                        .contains(
                                "QUO-2026-00013"
                        )
        );
    }

    @Test
    void aClosedRfqSaysWhetherTheSupplierQuotationIsBeingEvaluated() {
        assertTrue(
                single(
                        "CLOSED",
                        false,
                        true,
                        "QUO-2026-00014"
                )
                        .message()
                        .contains(
                                "being evaluated"
                        )
        );

        assertTrue(
                single(
                        "CLOSED",
                        false,
                        false,
                        null
                )
                        .message()
                        .contains(
                                "did not submit"
                        )
        );
    }

    @Test
    void aCancelledRfqIsReportedAsCancelled() {
        assertEquals(
                "RFQ_CANCELLED",
                single(
                        "CANCELLED",
                        false,
                        false,
                        null
                )
                        .kind()
        );
    }

    @Test
    void updatesAreAlwaysScopedToTheSignedInSupplier() {
        when(
                updateRepository.findRecent(
                        any(),
                        anyInt(),
                        anyInt()
                )
        ).thenReturn(
                List.of()
        );

        service.updates(
                "token"
        );

        verify(
                updateRepository
        ).findRecent(
                eq(
                        supplierId
                ),
                anyInt(),
                anyInt()
        );
    }

    @Test
    void anInvalidSessionIsRejectedBeforeAnyDataIsRead() {
        when(
                sessionRepository.findActiveSession(
                        any()
                )
        ).thenReturn(
                (SupplierPortalRfqRepository.PortalSession) null
        );

        IllegalArgumentException error =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                service.updates(
                                        "bad-token"
                                )
                );

        assertTrue(
                error.getMessage()
                        .contains(
                                "session"
                        )
        );

        verify(
                updateRepository,
                never()
        ).findRecent(
                any(),
                anyInt(),
                anyInt()
        );
    }
}
