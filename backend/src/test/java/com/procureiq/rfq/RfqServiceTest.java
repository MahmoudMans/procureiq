package com.procureiq.rfq;

import com.procureiq.organization.DepartmentEntity;
import com.procureiq.purchaserequest.PurchaseRequestEntity;
import com.procureiq.purchaserequest.PurchaseRequestItemEntity;
import com.procureiq.purchaserequest.PurchaseRequestRepository;
import com.procureiq.purchaserequest.PurchaseRequestStatus;
import com.procureiq.supplier.SupplierEntity;
import com.procureiq.supplier.SupplierRepository;
import com.procureiq.supplier.SupplierStatus;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RfqServiceTest {

    private RfqRepository rfqRepository;
    private PurchaseRequestRepository purchaseRequestRepository;
    private SupplierRepository supplierRepository;
    private AppUserRepository appUserRepository;
    private RfqService rfqService;

    private UUID userId;
    private UUID purchaseRequestId;
    private UUID supplierId;

    private AppUserEntity buyer;
    private PurchaseRequestEntity purchaseRequest;
    private SupplierEntity supplier;

    @BeforeEach
    void setUp() {
        rfqRepository =
                mock(
                        RfqRepository.class
                );

        purchaseRequestRepository =
                mock(
                        PurchaseRequestRepository.class
                );

        supplierRepository =
                mock(
                        SupplierRepository.class
                );

        appUserRepository =
                mock(
                        AppUserRepository.class
                );

        rfqService =
                new RfqService(
                        rfqRepository,
                        purchaseRequestRepository,
                        supplierRepository,
                        appUserRepository
                );

        userId =
                UUID.randomUUID();

        purchaseRequestId =
                UUID.randomUUID();

        supplierId =
                UUID.randomUUID();

        buyer =
                mock(
                        AppUserEntity.class
                );

        purchaseRequest =
                mock(
                        PurchaseRequestEntity.class
                );

        supplier =
                mock(
                        SupplierEntity.class
                );

        AppUserEntity requester =
                mock(
                        AppUserEntity.class
                );

        DepartmentEntity department =
                mock(
                        DepartmentEntity.class
                );

        PurchaseRequestItemEntity requestItem =
                mock(
                        PurchaseRequestItemEntity.class
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
                purchaseRequest.getId()
        ).thenReturn(
                purchaseRequestId
        );

        when(
                purchaseRequest.getStatus()
        ).thenReturn(
                PurchaseRequestStatus.APPROVED
        );

        when(
                purchaseRequest.getRequestNumber()
        ).thenReturn(
                "PR-2026-00001"
        );

        when(
                purchaseRequest.getTitle()
        ).thenReturn(
                "Operations laptops"
        );

        when(
                purchaseRequest.getCurrency()
        ).thenReturn(
                "EUR"
        );

        when(
                purchaseRequest.getEstimatedTotalAmount()
        ).thenReturn(
                new BigDecimal(
                        "4500.00"
                )
        );

        when(
                purchaseRequest.getRequester()
        ).thenReturn(
                requester
        );

        when(
                purchaseRequest.getDepartment()
        ).thenReturn(
                department
        );

        when(
                requester.getFullName()
        ).thenReturn(
                "Emma Laurent"
        );

        when(
                department.getName()
        ).thenReturn(
                "Operations"
        );

        when(
                requestItem.getItemName()
        ).thenReturn(
                "Business laptop"
        );

        when(
                requestItem.getDescription()
        ).thenReturn(
                "16GB RAM laptop"
        );

        when(
                requestItem.getCategory()
        ).thenReturn(
                "IT & Technology"
        );

        when(
                requestItem.getQuantity()
        ).thenReturn(
                new BigDecimal("5")
        );

        when(
                requestItem.getUnit()
        ).thenReturn(
                "EA"
        );

        when(
                purchaseRequest.getItems()
        ).thenReturn(
                List.of(
                        requestItem
                )
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
                supplier.getCategory()
        ).thenReturn(
                "IT & Technology"
        );

        when(
                supplier.getCountry()
        ).thenReturn(
                "Germany"
        );

        when(
                supplier.getStatus()
        ).thenReturn(
                SupplierStatus.ACTIVE
        );

        when(
                appUserRepository
                        .findById(userId)
        ).thenReturn(
                Optional.of(buyer)
        );

        when(
                purchaseRequestRepository
                        .findDetailedById(
                                purchaseRequestId
                        )
        ).thenReturn(
                Optional.of(
                        purchaseRequest
                )
        );

        when(
                supplierRepository
                        .findByIdAndActiveTrue(
                                supplierId
                        )
        ).thenReturn(
                Optional.of(
                        supplier
                )
        );
    }

    @Test
    void createRfqShouldCopyApprovedPurchaseRequestLines() {
        when(
                rfqRepository
                        .existsBySourcePurchaseRequest_Id(
                                purchaseRequestId
                        )
        ).thenReturn(false);

        when(
                rfqRepository
                        .nextRfqSequence()
        ).thenReturn(12L);

        when(
                rfqRepository.save(
                        any(
                                RfqEntity.class
                        )
                )
        ).thenAnswer(
                invocation ->
                        invocation.getArgument(0)
        );

        RfqResponse response =
                rfqService.createRfq(
                        userId,
                        new RfqCreateInput(
                                purchaseRequestId,
                                "Laptop sourcing event",
                                "Competitive sourcing for approved laptop purchase.",
                                LocalDateTime.now()
                                        .plusDays(7),
                                List.of(
                                        supplierId
                                )
                        )
                );

        assertEquals(
                RfqStatus.DRAFT,
                response.status()
        );

        assertEquals(
                1,
                response.lineItems()
                        .size()
        );

        assertEquals(
                1,
                response.invitations()
                        .size()
        );

        assertEquals(
                "Business laptop",
                response.lineItems()
                        .getFirst()
                        .itemName()
        );

        assertEquals(
                "Helios Technology Systems GmbH",
                response.invitations()
                        .getFirst()
                        .supplierName()
        );
    }

    @Test
    void createRfqShouldRejectNonApprovedPurchaseRequest() {
        when(
                purchaseRequest.getStatus()
        ).thenReturn(
                PurchaseRequestStatus.SUBMITTED
        );

        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                rfqService.createRfq(
                                        userId,
                                        new RfqCreateInput(
                                                purchaseRequestId,
                                                "Sourcing event",
                                                null,
                                                LocalDateTime.now()
                                                        .plusDays(7),
                                                List.of(
                                                        supplierId
                                                )
                                        )
                                )
                );

        assertEquals(
                "Only approved purchase requests can be converted into RFQs.",
                exception.getMessage()
        );
    }
}
