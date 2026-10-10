package com.procureiq.quotation;

import com.procureiq.rfq.RfqEntity;
import com.procureiq.rfq.RfqInvitationStatus;
import com.procureiq.rfq.RfqRepository;
import com.procureiq.rfq.RfqStatus;
import com.procureiq.rfq.RfqSupplierInvitationEntity;
import com.procureiq.supplier.SupplierEntity;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * A supplier that declined its RFQ invitation must not have a quotation recorded, edited or
 * submitted for it until it reconsiders. The rule lives in the service so it holds for the
 * buyer screen, the supplier portal and direct API calls alike.
 */
class QuotationDeclinedSupplierTest {

    private QuotationRepository quotationRepository;

    private QuotationService quotationService;

    private UUID userId;
    private UUID rfqId;
    private UUID supplierId;
    private UUID quotationId;

    @BeforeEach
    void setUp() {
        quotationRepository =
                mock(
                        QuotationRepository.class
                );

        RfqRepository rfqRepository =
                mock(
                        RfqRepository.class
                );

        AppUserRepository appUserRepository =
                mock(
                        AppUserRepository.class
                );

        quotationService =
                new QuotationService(
                        quotationRepository,
                        rfqRepository,
                        appUserRepository
                );

        userId =
                UUID.randomUUID();

        rfqId =
                UUID.randomUUID();

        supplierId =
                UUID.randomUUID();

        quotationId =
                UUID.randomUUID();

        AppUserEntity buyer =
                mock(
                        AppUserEntity.class
                );

        when(
                buyer.getId()
        ).thenReturn(
                userId
        );

        when(
                buyer.getRole()
        ).thenReturn(
                ProcurementRole.BUYER
        );

        when(
                buyer.isActive()
        ).thenReturn(true);

        when(
                appUserRepository.findById(
                        userId
                )
        ).thenReturn(
                Optional.of(
                        buyer
                )
        );

        SupplierEntity supplier =
                mock(
                        SupplierEntity.class
                );

        when(
                supplier.getId()
        ).thenReturn(
                supplierId
        );

        RfqSupplierInvitationEntity declined =
                mock(
                        RfqSupplierInvitationEntity.class
                );

        when(
                declined.getSupplier()
        ).thenReturn(
                supplier
        );

        when(
                declined.getStatus()
        ).thenReturn(
                RfqInvitationStatus.DECLINED
        );

        RfqEntity rfq =
                mock(
                        RfqEntity.class
                );

        when(
                rfq.getId()
        ).thenReturn(
                rfqId
        );

        when(
                rfq.getStatus()
        ).thenReturn(
                RfqStatus.PUBLISHED
        );

        when(
                rfq.getInvitations()
        ).thenReturn(
                List.of(
                        declined
                )
        );

        when(
                rfqRepository.findById(
                        rfqId
                )
        ).thenReturn(
                Optional.of(
                        rfq
                )
        );

        QuotationEntity quotation =
                mock(
                        QuotationEntity.class
                );

        when(
                quotation.getStatus()
        ).thenReturn(
                QuotationStatus.DRAFT
        );

        when(
                quotation.getRfq()
        ).thenReturn(
                rfq
        );

        when(
                quotation.getSupplier()
        ).thenReturn(
                supplier
        );

        when(
                quotation.getValidityDate()
        ).thenReturn(
                LocalDate.now()
                        .plusDays(
                                30
                        )
        );

        when(
                quotationRepository.findById(
                        quotationId
                )
        ).thenReturn(
                Optional.of(
                        quotation
                )
        );
    }

    @Test
    void createIsRejectedForASupplierThatDeclined() {
        QuotationCreateInput input =
                new QuotationCreateInput(
                        supplierId,
                        14,
                        "30 days net",
                        LocalDate.now()
                                .plusDays(
                                        30
                                ),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        List.of()
                );

        IllegalArgumentException error =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                quotationService.createQuotation(
                                        userId,
                                        rfqId,
                                        input
                                )
                );

        assertTrue(
                error.getMessage()
                        .contains(
                                "declined"
                        )
        );

        verify(
                quotationRepository,
                never()
        ).save(
                any(
                        QuotationEntity.class
                )
        );
    }

    @Test
    void updateIsRejectedForASupplierThatDeclined() {
        QuotationUpdateInput input =
                new QuotationUpdateInput(
                        14,
                        "30 days net",
                        LocalDate.now()
                                .plusDays(
                                        30
                                ),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        List.of()
                );

        IllegalArgumentException error =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                quotationService.updateQuotation(
                                        userId,
                                        quotationId,
                                        input
                                )
                );

        assertTrue(
                error.getMessage()
                        .contains(
                                "declined"
                        )
        );

        verify(
                quotationRepository,
                never()
        ).save(
                any(
                        QuotationEntity.class
                )
        );
    }

    @Test
    void submitIsRejectedForASupplierThatDeclined() {
        IllegalArgumentException error =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                quotationService.submitQuotation(
                                        userId,
                                        quotationId
                                )
                );

        assertTrue(
                error.getMessage()
                        .contains(
                                "declined"
                        )
        );

        verify(
                quotationRepository,
                never()
        ).save(
                any(
                        QuotationEntity.class
                )
        );
    }
}
