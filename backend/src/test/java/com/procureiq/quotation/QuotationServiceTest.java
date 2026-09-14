package com.procureiq.quotation;

import com.procureiq.rfq.RfqEntity;
import com.procureiq.rfq.RfqLineItemEntity;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class QuotationServiceTest {

    private QuotationRepository
            quotationRepository;

    private RfqRepository
            rfqRepository;

    private AppUserRepository
            appUserRepository;

    private QuotationService
            quotationService;

    private UUID userId;
    private UUID rfqId;
    private UUID supplierId;
    private UUID rfqLineId;

    private AppUserEntity buyer;
    private RfqEntity rfq;
    private SupplierEntity supplier;
    private RfqLineItemEntity rfqLine;

    @BeforeEach
    void setUp() {
        quotationRepository =
                mock(
                        QuotationRepository.class
                );

        rfqRepository =
                mock(
                        RfqRepository.class
                );

        appUserRepository =
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

        rfqLineId =
                UUID.randomUUID();

        buyer =
                mock(
                        AppUserEntity.class
                );

        rfq =
                mock(
                        RfqEntity.class
                );

        supplier =
                mock(
                        SupplierEntity.class
                );

        rfqLine =
                mock(
                        RfqLineItemEntity.class
                );

        RfqSupplierInvitationEntity invitation =
                mock(
                        RfqSupplierInvitationEntity.class
                );

        when(
                buyer.getId()
        ).thenReturn(
                userId
        );

        when(
                buyer.getFullName()
        ).thenReturn(
                "Daniel Moreau"
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
                rfq.getId()
        ).thenReturn(
                rfqId
        );

        when(
                rfq.getRfqNumber()
        ).thenReturn(
                "RFQ-2026-00001"
        );

        when(
                rfq.getStatus()
        ).thenReturn(
                RfqStatus.PUBLISHED
        );

        when(
                rfq.getCurrency()
        ).thenReturn(
                "EUR"
        );

        when(
                supplier.getId()
        ).thenReturn(
                supplierId
        );

        when(
                supplier.getSupplierCode()
        ).thenReturn(
                "SUP-0003"
        );

        when(
                supplier.getLegalName()
        ).thenReturn(
                "Helios Technology Systems GmbH"
        );

        when(
                invitation.getSupplier()
        ).thenReturn(
                supplier
        );

        when(
                rfq.getInvitations()
        ).thenReturn(
                List.of(
                        invitation
                )
        );

        when(
                rfqLine.getId()
        ).thenReturn(
                rfqLineId
        );

        when(
                rfqLine.getLineNumber()
        ).thenReturn(
                1
        );

        when(
                rfqLine.getItemName()
        ).thenReturn(
                "Business laptop"
        );

        when(
                rfqLine.getCategory()
        ).thenReturn(
                "IT & Technology"
        );

        when(
                rfqLine.getQuantity()
        ).thenReturn(
                new BigDecimal("5.000")
        );

        when(
                rfqLine.getUnit()
        ).thenReturn(
                "EA"
        );

        when(
                rfq.getLineItems()
        ).thenReturn(
                List.of(
                        rfqLine
                )
        );

        when(
                appUserRepository
                        .findById(userId)
        ).thenReturn(
                Optional.of(
                        buyer
                )
        );

        when(
                rfqRepository
                        .findById(rfqId)
        ).thenReturn(
                Optional.of(
                        rfq
                )
        );
    }

    @Test
    void createQuotationShouldCalculateCommercialTotal() {
        when(
                quotationRepository
                        .existsByRfq_IdAndSupplier_Id(
                                rfqId,
                                supplierId
                        )
        ).thenReturn(false);

        when(
                quotationRepository
                        .nextQuotationSequence()
        ).thenReturn(8L);

        when(
                quotationRepository.save(
                        any(
                                QuotationEntity.class
                        )
                )
        ).thenAnswer(
                invocation ->
                        invocation.getArgument(0)
        );

        QuotationResponse response =
                quotationService
                        .createQuotation(
                                userId,
                                rfqId,
                                new QuotationCreateInput(
                                        supplierId,
                                        14,
                                        "30 days net",
                                        LocalDate.now()
                                                .plusDays(30),
                                        new BigDecimal("100.00"),
                                        new BigDecimal("50.00"),
                                        new BigDecimal("200.00"),
                                        List.of(
                                                new QuotationLineInput(
                                                        rfqLineId,
                                                        new BigDecimal("1000.00")
                                                )
                                        )
                                )
                        );

        assertEquals(
                new BigDecimal("5000.00"),
                response.subtotal()
        );

        assertEquals(
                new BigDecimal("5150.00"),
                response.totalAmount()
        );

        assertEquals(
                QuotationStatus.DRAFT,
                response.status()
        );

        assertEquals(
                1,
                response.lines()
                        .size()
        );
    }

    @Test
    void quotationMustPriceEveryRfqLine() {
        when(
                quotationRepository
                        .existsByRfq_IdAndSupplier_Id(
                                rfqId,
                                supplierId
                        )
        ).thenReturn(false);

        when(
                quotationRepository
                        .nextQuotationSequence()
        ).thenReturn(9L);

        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                quotationService
                                        .createQuotation(
                                                userId,
                                                rfqId,
                                                new QuotationCreateInput(
                                                        supplierId,
                                                        10,
                                                        "30 days net",
                                                        LocalDate.now()
                                                                .plusDays(30),
                                                        BigDecimal.ZERO,
                                                        BigDecimal.ZERO,
                                                        BigDecimal.ZERO,
                                                        List.of()
                                                )
                                        )
                );

        assertEquals(
                "Quotation must contain pricing for every RFQ line.",
                exception.getMessage()
        );
    }
}
