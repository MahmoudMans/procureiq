package com.procureiq.analytics;

import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AnalyticsServiceTest {

    private AnalyticsRepository
            analyticsRepository;

    private AppUserRepository
            appUserRepository;

    private AnalyticsService
            analyticsService;

    private UUID userId;

    @BeforeEach
    void setUp() {
        analyticsRepository =
                mock(
                        AnalyticsRepository.class
                );

        appUserRepository =
                mock(
                        AppUserRepository.class
                );

        analyticsService =
                new AnalyticsService(
                        analyticsRepository,
                        appUserRepository
                );

        userId =
                UUID.randomUUID();
    }

    @Test
    void shouldCalculateAverageOrderValueAndShares() {
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
                ProcurementRole.PROCUREMENT_MANAGER
        );

        when(
                appUserRepository
                        .findById(userId)
        ).thenReturn(
                Optional.of(user)
        );

        when(
                analyticsRepository
                        .committedSpend()
        ).thenReturn(
                new BigDecimal(
                        "12000.00"
                )
        );

        when(
                analyticsRepository
                        .committedOrderCount()
        ).thenReturn(3L);

        when(
                analyticsRepository
                        .activeSupplierCount()
        ).thenReturn(8L);

        when(
                analyticsRepository
                        .sourcingSavings()
        ).thenReturn(
                new BigDecimal(
                        "1800.00"
                )
        );

        when(
                analyticsRepository
                        .averageProcurementCycleDays()
        ).thenReturn(
                new BigDecimal(
                        "5.50"
                )
        );

        when(
                analyticsRepository
                        .openDeliveryOrders()
        ).thenReturn(2L);

        when(
                analyticsRepository
                        .overdueDeliveryOrders()
        ).thenReturn(1L);

        when(
                analyticsRepository
                        .monthlySpend()
        ).thenReturn(
                List.of(
                        new AnalyticsRepository.MonthRow(
                                "2026-09",
                                new BigDecimal(
                                        "12000.00"
                                ),
                                3
                        )
                )
        );

        when(
                analyticsRepository
                        .spendBySupplier()
        ).thenReturn(
                List.of(
                        new AnalyticsRepository.ValueRow(
                                "Supplier A",
                                new BigDecimal(
                                        "9000.00"
                                ),
                                2
                        ),
                        new AnalyticsRepository.ValueRow(
                                "Supplier B",
                                new BigDecimal(
                                        "3000.00"
                                ),
                                1
                        )
                )
        );

        when(
                analyticsRepository
                        .spendByCategory()
        ).thenReturn(List.of());

        when(
                analyticsRepository
                        .spendByDepartment()
        ).thenReturn(List.of());

        when(
                analyticsRepository
                        .riskExposure()
        ).thenReturn(List.of());

        when(
                analyticsRepository
                        .purchaseOrderPipeline()
        ).thenReturn(List.of());

        ProcurementAnalyticsResponse response =
                analyticsService
                        .getAnalytics(
                                userId
                        );

        assertEquals(
                new BigDecimal("4000.00"),
                response.summary()
                        .averageOrderValue()
        );

        assertEquals(
                new BigDecimal("75.00"),
                response.spendBySupplier()
                        .getFirst()
                        .sharePercent()
        );

        assertEquals(
                new BigDecimal("25.00"),
                response.spendBySupplier()
                        .getLast()
                        .sharePercent()
        );
    }

    @Test
    void requesterCannotAccessAnalytics() {
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

        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                analyticsService
                                        .getAnalytics(
                                                userId
                                        )
                );

        assertEquals(
                "Your ProcureIQ role cannot access procurement analytics.",
                exception.getMessage()
        );
    }
}
