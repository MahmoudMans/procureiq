package com.procureiq.reporting;

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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ReportingServiceTest {

    private ReportingRepository
            reportingRepository;

    private ReportSnapshotRepository
            snapshotRepository;

    private AppUserRepository
            appUserRepository;

    private ReportingService
            reportingService;

    private UUID userId;

    @BeforeEach
    void setUp() {
        reportingRepository =
                mock(
                        ReportingRepository.class
                );

        snapshotRepository =
                mock(
                        ReportSnapshotRepository.class
                );

        appUserRepository =
                mock(
                        AppUserRepository.class
                );

        reportingService =
                new ReportingService(
                        reportingRepository,
                        snapshotRepository,
                        appUserRepository
                );

        userId =
                UUID.randomUUID();
    }

    @Test
    void executiveReportShouldCalculateAverageOrderAndShares() {
        AppUserEntity user =
                mock(
                        AppUserEntity.class
                );

        LocalDate from =
                LocalDate.of(
                        2026,
                        1,
                        1
                );

        LocalDate to =
                LocalDate.of(
                        2026,
                        12,
                        31
                );

        when(
                user.isActive()
        ).thenReturn(true);

        when(
                user.getRole()
        ).thenReturn(
                ProcurementRole.PROCUREMENT_MANAGER
        );

        when(
                appUserRepository
                        .findById(userId)
        ).thenReturn(
                Optional.of(user)
        );

        when(
                reportingRepository
                        .committedSpend(
                                from,
                                to
                        )
        ).thenReturn(
                new BigDecimal(
                        "20000.00"
                )
        );

        when(
                reportingRepository
                        .purchaseOrderCount(
                                from,
                                to
                        )
        ).thenReturn(4L);

        when(
                reportingRepository
                        .supplierCount(
                                from,
                                to
                        )
        ).thenReturn(2L);

        when(
                reportingRepository
                        .overdueOrderCount(
                                from,
                                to
                        )
        ).thenReturn(1L);

        when(
                reportingRepository
                        .sourcingSavings(
                                from,
                                to
                        )
        ).thenReturn(
                new BigDecimal(
                        "2500.00"
                )
        );

        when(
                reportingRepository
                        .averageCycleDays(
                                from,
                                to
                        )
        ).thenReturn(
                new BigDecimal(
                        "6.25"
                )
        );

        when(
                reportingRepository
                        .spendBySupplier(
                                from,
                                to
                        )
        ).thenReturn(
                List.of(
                        new ReportingRepository.ValueRow(
                                "Supplier A",
                                new BigDecimal(
                                        "15000.00"
                                ),
                                3
                        ),
                        new ReportingRepository.ValueRow(
                                "Supplier B",
                                new BigDecimal(
                                        "5000.00"
                                ),
                                1
                        )
                )
        );

        when(
                reportingRepository
                        .spendByCategory(
                                from,
                                to
                        )
        ).thenReturn(List.of());

        when(
                reportingRepository
                        .sourcingRows(
                                from,
                                to
                        )
        ).thenReturn(List.of());

        when(
                reportingRepository
                        .purchaseOrders(
                                from,
                                to
                        )
        ).thenReturn(List.of());

        when(
                reportingRepository
                        .deliveries(
                                from,
                                to
                        )
        ).thenReturn(List.of());

        ExecutiveReportResponse response =
                reportingService
                        .executiveReport(
                                userId,
                                from,
                                to
                        );

        assertEquals(
                new BigDecimal("5000.00"),
                response.summary()
                        .averageOrderValue()
        );

        assertEquals(
                new BigDecimal("75.00"),
                response.spendBySupplier()
                        .getFirst()
                        .sharePercent()
        );
    }

    @Test
    void invalidPeriodShouldBeRejected() {
        AppUserEntity user =
                mock(
                        AppUserEntity.class
                );

        when(
                user.isActive()
        ).thenReturn(true);

        when(
                user.getRole()
        ).thenReturn(
                ProcurementRole.ADMIN
        );

        when(
                appUserRepository
                        .findById(userId)
        ).thenReturn(
                Optional.of(user)
        );

        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                reportingService
                                        .executiveReport(
                                                userId,
                                                LocalDate.of(
                                                        2026,
                                                        12,
                                                        31
                                                ),
                                                LocalDate.of(
                                                        2026,
                                                        1,
                                                        1
                                                )
                                        )
                );

        assertEquals(
                "Report period start must not be after report period end.",
                exception.getMessage()
        );
    }

    @Test
    void requesterCannotAccessReports() {
        AppUserEntity user =
                mock(
                        AppUserEntity.class
                );

        when(
                user.isActive()
        ).thenReturn(true);

        when(
                user.getRole()
        ).thenReturn(
                ProcurementRole.REQUESTER
        );

        when(
                appUserRepository
                        .findById(userId)
        ).thenReturn(
                Optional.of(user)
        );

        assertThrows(
                IllegalArgumentException.class,
                () ->
                        reportingService
                                .executiveReport(
                                        userId,
                                        null,
                                        null
                                )
        );
    }
}
