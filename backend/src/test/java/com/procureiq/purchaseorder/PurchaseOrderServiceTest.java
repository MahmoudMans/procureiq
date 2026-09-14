package com.procureiq.purchaseorder;

import com.procureiq.evaluation.AwardDecisionEntity;
import com.procureiq.evaluation.AwardDecisionRepository;
import com.procureiq.quotation.QuotationEntity;
import com.procureiq.quotation.QuotationLineEntity;
import com.procureiq.quotation.QuotationStatus;
import com.procureiq.purchaserequest.PurchaseRequestEntity;
import com.procureiq.rfq.RfqEntity;
import com.procureiq.rfq.RfqLineItemEntity;
import com.procureiq.rfq.RfqRepository;
import com.procureiq.rfq.RfqStatus;
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

class PurchaseOrderServiceTest {

    private PurchaseOrderRepository
            purchaseOrderRepository;

    private RfqRepository
            rfqRepository;

    private AwardDecisionRepository
            awardDecisionRepository;

    private AppUserRepository
            appUserRepository;

    private PurchaseOrderService
            purchaseOrderService;

    private UUID userId;
    private UUID rfqId;

    private AppUserEntity buyer;
    private RfqEntity rfq;
    private AwardDecisionEntity award;
    private QuotationEntity quotation;
    private SupplierEntity supplier;

    @BeforeEach
    void setUp() {
        purchaseOrderRepository =
                mock(
                        PurchaseOrderRepository.class
                );

        rfqRepository =
                mock(
                        RfqRepository.class
                );

        awardDecisionRepository =
                mock(
                        AwardDecisionRepository.class
                );

        appUserRepository =
                mock(
                        AppUserRepository.class
                );

        purchaseOrderService =
                new PurchaseOrderService(
                        purchaseOrderRepository,
                        rfqRepository,
                        awardDecisionRepository,
                        appUserRepository
                );

        userId =
                UUID.randomUUID();

        rfqId =
                UUID.randomUUID();

        buyer =
                mock(
                        AppUserEntity.class
                );

        rfq =
                mock(
                        RfqEntity.class
                );

        award =
                mock(
                        AwardDecisionEntity.class
                );

        quotation =
                mock(
                        QuotationEntity.class
                );

        supplier =
                mock(
                        SupplierEntity.class
                );

        PurchaseRequestEntity sourcePurchaseRequest =
                mock(
                        PurchaseRequestEntity.class
                );

        QuotationLineEntity quotationLine =
                mock(
                        QuotationLineEntity.class
                );

        RfqLineItemEntity rfqLine =
                mock(
                        RfqLineItemEntity.class
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
                rfq.getStatus()
        ).thenReturn(
                RfqStatus.AWARDED
        );

        when(
                rfq.getRfqNumber()
        ).thenReturn(
                "RFQ-2026-00001"
        );

        when(
                rfq.getSourcePurchaseRequest()
        ).thenReturn(
                sourcePurchaseRequest
        );

        when(
                sourcePurchaseRequest.getId()
        ).thenReturn(
                UUID.randomUUID()
        );

        when(
                sourcePurchaseRequest.getRequestNumber()
        ).thenReturn(
                "PR-2026-00001"
        );

        when(
                award.getId()
        ).thenReturn(
                UUID.randomUUID()
        );

        when(
                award.getSelectedQuotation()
        ).thenReturn(
                quotation
        );

        when(
                quotation.getId()
        ).thenReturn(
                UUID.randomUUID()
        );

        when(
                quotation.getQuotationNumber()
        ).thenReturn(
                "QT-2026-00001"
        );

        when(
                quotation.getStatus()
        ).thenReturn(
                QuotationStatus.SUBMITTED
        );

        when(
                quotation.getSupplier()
        ).thenReturn(
                supplier
        );

        when(
                quotation.getCurrency()
        ).thenReturn(
                "EUR"
        );

        when(
                quotation.getPaymentTerms()
        ).thenReturn(
                "30 days net"
        );

        when(
                quotation.getSubtotal()
        ).thenReturn(
                new BigDecimal(
                        "5000.00"
                )
        );

        when(
                quotation.getDiscountAmount()
        ).thenReturn(
                new BigDecimal(
                        "100.00"
                )
        );

        when(
                quotation.getShippingAmount()
        ).thenReturn(
                new BigDecimal(
                        "50.00"
                )
        );

        when(
                quotation.getTaxAmount()
        ).thenReturn(
                new BigDecimal(
                        "200.00"
                )
        );

        when(
                quotation.getTotalAmount()
        ).thenReturn(
                new BigDecimal(
                        "5150.00"
                )
        );

        when(
                supplier.getId()
        ).thenReturn(
                UUID.randomUUID()
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
                quotationLine.getLineNumber()
        ).thenReturn(
                1
        );

        when(
                quotationLine.getRfqLineItem()
        ).thenReturn(
                rfqLine
        );

        when(
                rfqLine.getItemName()
        ).thenReturn(
                "Business laptop"
        );

        when(
                rfqLine.getDescription()
        ).thenReturn(
                "16GB RAM"
        );

        when(
                rfqLine.getCategory()
        ).thenReturn(
                "IT & Technology"
        );

        when(
                quotationLine.getQuantity()
        ).thenReturn(
                new BigDecimal(
                        "5.000"
                )
        );

        when(
                quotationLine.getUnit()
        ).thenReturn(
                "EA"
        );

        when(
                quotationLine.getUnitPrice()
        ).thenReturn(
                new BigDecimal(
                        "1000.00"
                )
        );

        when(
                quotationLine.getLineSubtotal()
        ).thenReturn(
                new BigDecimal(
                        "5000.00"
                )
        );

        when(
                quotation.getLines()
        ).thenReturn(
                List.of(
                        quotationLine
                )
        );

        when(
                appUserRepository
                        .findById(
                                userId
                        )
        ).thenReturn(
                Optional.of(
                        buyer
                )
        );

        when(
                rfqRepository
                        .findById(
                                rfqId
                        )
        ).thenReturn(
                Optional.of(
                        rfq
                )
        );

        when(
                awardDecisionRepository
                        .findByRfq_Id(
                                rfqId
                        )
        ).thenReturn(
                Optional.of(
                        award
                )
        );
    }

    @Test
    void awardedRfqShouldConvertToPurchaseOrder() {
        when(
                purchaseOrderRepository
                        .existsByRfq_Id(
                                rfqId
                        )
        ).thenReturn(false);

        when(
                purchaseOrderRepository
                        .nextPurchaseOrderSequence()
        ).thenReturn(18L);

        when(
                purchaseOrderRepository
                        .save(
                                any(
                                        PurchaseOrderEntity.class
                                )
                        )
        ).thenAnswer(
                invocation ->
                        invocation.getArgument(0)
        );

        PurchaseOrderResponse response =
                purchaseOrderService
                        .createOrder(
                                userId,
                                new PurchaseOrderCreateInput(
                                        rfqId,
                                        LocalDate.now()
                                                .plusDays(21),
                                        "10 Procurement Avenue, Paris",
                                        "Deliver to operations reception."
                                )
                        );

        assertEquals(
                PurchaseOrderStatus.DRAFT,
                response.status()
        );

        assertEquals(
                new BigDecimal("5150.00"),
                response.totalAmount()
        );

        assertEquals(
                1,
                response.lines()
                        .size()
        );

        assertEquals(
                "Business laptop",
                response.lines()
                        .getFirst()
                        .itemName()
        );
    }

    @Test
    void nonAwardedRfqCannotCreatePurchaseOrder() {
        when(
                rfq.getStatus()
        ).thenReturn(
                RfqStatus.CLOSED
        );

        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                purchaseOrderService
                                        .createOrder(
                                                userId,
                                                new PurchaseOrderCreateInput(
                                                        rfqId,
                                                        LocalDate.now()
                                                                .plusDays(10),
                                                        "Delivery location",
                                                        null
                                                )
                                        )
                );

        assertEquals(
                "Only awarded RFQs can be converted into purchase orders.",
                exception.getMessage()
        );
    }
}
