package com.procureiq.purchaserequest;

import com.procureiq.organization.DepartmentEntity;
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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PurchaseRequestServiceTest {

    private PurchaseRequestRepository
            purchaseRequestRepository;

    private AppUserRepository
            appUserRepository;

    private PurchaseRequestService
            purchaseRequestService;

    private UUID userId;

    private AppUserEntity user;

    private DepartmentEntity department;

    @BeforeEach
    void setUp() {
        purchaseRequestRepository =
                mock(
                        PurchaseRequestRepository.class
                );

        appUserRepository =
                mock(
                        AppUserRepository.class
                );

        purchaseRequestService =
                new PurchaseRequestService(
                        purchaseRequestRepository,
                        appUserRepository
                );

        userId = UUID.randomUUID();

        user =
                mock(
                        AppUserEntity.class
                );

        department =
                mock(
                        DepartmentEntity.class
                );

        when(
                user.getId()
        ).thenReturn(
                userId
        );

        when(
                user.getFullName()
        ).thenReturn(
                "Emma Laurent"
        );

        when(
                user.getEmail()
        ).thenReturn(
                "requester@procureiq.local"
        );

        when(
                user.getRole()
        ).thenReturn(
                ProcurementRole.REQUESTER
        );

        when(
                user.isActive()
        ).thenReturn(true);

        when(
                user.getDepartment()
        ).thenReturn(
                department
        );

        when(
                department.getId()
        ).thenReturn(
                UUID.randomUUID()
        );

        when(
                department.getCode()
        ).thenReturn(
                "OPS"
        );

        when(
                department.getName()
        ).thenReturn(
                "Operations"
        );

        when(
                appUserRepository
                        .findById(userId)
        ).thenReturn(
                Optional.of(user)
        );
    }

    @Test
    void createRequestShouldCalculateServerSideTotals() {
        when(
                purchaseRequestRepository
                        .nextRequestSequence()
        ).thenReturn(42L);

        when(
                purchaseRequestRepository
                        .save(
                                any(
                                        PurchaseRequestEntity.class
                                )
                        )
        ).thenAnswer(
                invocation ->
                        invocation.getArgument(0)
        );

        PurchaseRequestInput input =
                new PurchaseRequestInput(
                        "Office equipment refresh",
                        "Replace equipment in the operations office.",
                        "Existing equipment is beyond the internal replacement cycle.",
                        "OPS-240",
                        "EUR",
                        LocalDate.now()
                                .plusDays(14),
                        List.of(
                                new PurchaseRequestItemInput(
                                        "Ergonomic keyboard",
                                        "Mechanical ergonomic keyboard",
                                        "IT & Technology",
                                        new BigDecimal("3"),
                                        "EA",
                                        new BigDecimal("12.50")
                                ),
                                new PurchaseRequestItemInput(
                                        "Cable management kit",
                                        null,
                                        "Office & Workplace",
                                        new BigDecimal("2"),
                                        "EA",
                                        new BigDecimal("5.00")
                                )
                        )
                );

        PurchaseRequestResponse response =
                purchaseRequestService
                        .createRequest(
                                userId,
                                input
                        );

        assertTrue(
                response.requestNumber()
                        .startsWith("PR-")
        );

        assertTrue(
                response.requestNumber()
                        .endsWith("-00042")
        );

        assertEquals(
                PurchaseRequestStatus.DRAFT,
                response.status()
        );

        assertEquals(
                new BigDecimal("47.50"),
                response.estimatedTotalAmount()
        );

        assertEquals(
                2,
                response.items().size()
        );

        assertEquals(
                new BigDecimal("37.50"),
                response.items()
                        .get(0)
                        .estimatedLineTotal()
        );

        assertEquals(
                new BigDecimal("10.00"),
                response.items()
                        .get(1)
                        .estimatedLineTotal()
        );
    }

    @Test
    void approverShouldNotCreatePurchaseRequest() {
        when(
                user.getRole()
        ).thenReturn(
                ProcurementRole.APPROVER
        );

        PurchaseRequestInput input =
                new PurchaseRequestInput(
                        "Request",
                        null,
                        "Required for operations.",
                        "FIN-100",
                        "EUR",
                        LocalDate.now()
                                .plusDays(5),
                        List.of(
                                new PurchaseRequestItemInput(
                                        "Item",
                                        null,
                                        "General",
                                        BigDecimal.ONE,
                                        "EA",
                                        BigDecimal.TEN
                                )
                        )
                );

        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                purchaseRequestService
                                        .createRequest(
                                                userId,
                                                input
                                        )
                );

        assertEquals(
                "Your ProcureIQ role cannot create purchase requests.",
                exception.getMessage()
        );
    }
}
