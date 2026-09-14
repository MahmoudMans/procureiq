package com.procureiq.supplierinsight;

import com.procureiq.supplier.SupplierEntity;
import com.procureiq.supplier.SupplierRepository;
import com.procureiq.supplier.SupplierRiskLevel;
import com.procureiq.supplier.SupplierStatus;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class Supplier360ServiceTest {

    private Supplier360Repository
            supplier360Repository;

    private SupplierRepository
            supplierRepository;

    private AppUserRepository
            appUserRepository;

    private Supplier360Service
            supplier360Service;

    private UUID userId;
    private UUID supplierId;

    @BeforeEach
    void setUp() {
        supplier360Repository =
                mock(
                        Supplier360Repository.class
                );

        supplierRepository =
                mock(
                        SupplierRepository.class
                );

        appUserRepository =
                mock(
                        AppUserRepository.class
                );

        supplier360Service =
                new Supplier360Service(
                        supplier360Repository,
                        supplierRepository,
                        appUserRepository
                );

        userId =
                UUID.randomUUID();

        supplierId =
                UUID.randomUUID();
    }

    @Test
    void shouldCalculateSupplierWinRateAndCategoryShares() {
        AppUserEntity user =
                mock(
                        AppUserEntity.class
                );

        SupplierEntity supplier =
                mock(
                        SupplierEntity.class
                );

        when(
                user.isActive()
        ).thenReturn(true);

        when(
                appUserRepository
                        .findById(userId)
        ).thenReturn(
                Optional.of(user)
        );

        when(
                supplierRepository
                        .findById(
                                supplierId
                        )
        ).thenReturn(
                Optional.of(
                        supplier
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
                "SUP-0001"
        );

        when(
                supplier.getLegalName()
        ).thenReturn(
                "Atlas Systems"
        );

        when(
                supplier.getCategory()
        ).thenReturn(
                "Technology"
        );

        when(
                supplier.getCountry()
        ).thenReturn(
                "France"
        );

        when(
                supplier.getStatus()
        ).thenReturn(
                SupplierStatus.ACTIVE
        );

        when(
                supplier.getRiskLevel()
        ).thenReturn(
                SupplierRiskLevel.LOW
        );

        when(
                supplier.getRating()
        ).thenReturn(
                new BigDecimal(
                        "4.50"
                )
        );

        when(
                supplier360Repository
                        .committedSpend(
                                supplierId
                        )
        ).thenReturn(
                new BigDecimal(
                        "15000.00"
                )
        );

        when(
                supplier360Repository
                        .submittedQuotationCount(
                                supplierId
                        )
        ).thenReturn(4L);

        when(
                supplier360Repository
                        .awardCount(
                                supplierId
                        )
        ).thenReturn(2L);

        when(
                supplier360Repository
                        .averageAwardValue(
                                supplierId
                        )
        ).thenReturn(
                new BigDecimal(
                        "7500.00"
                )
        );

        when(
                supplier360Repository
                        .deliveryPerformance(
                                supplierId
                        )
        ).thenReturn(
                new Supplier360Repository.DeliveryPerformanceRow(
                        3,
                        2,
                        2,
                        0,
                        new BigDecimal(
                                "100.00"
                        ),
                        new BigDecimal(
                                "85.00"
                        ),
                        null
                )
        );

        when(
                supplier360Repository
                        .categorySpend(
                                supplierId
                        )
        ).thenReturn(
                List.of(
                        new Supplier360Repository.CategorySpendRow(
                                "Hardware",
                                new BigDecimal(
                                        "12000.00"
                                ),
                                4
                        ),
                        new Supplier360Repository.CategorySpendRow(
                                "Services",
                                new BigDecimal(
                                        "3000.00"
                                ),
                                2
                        )
                )
        );

        when(
                supplier360Repository
                        .monthlySpend(
                                supplierId
                        )
        ).thenReturn(List.of());

        when(
                supplier360Repository
                        .recentPurchaseOrders(
                                supplierId
                        )
        ).thenReturn(List.of());

        when(
                supplier360Repository
                        .recentSourcing(
                                supplierId
                        )
        ).thenReturn(List.of());

        when(
                supplier360Repository
                        .recentAwards(
                                supplierId
                        )
        ).thenReturn(List.of());

        when(
                supplier360Repository
                        .recentActivity(
                                supplierId
                        )
        ).thenReturn(List.of());

        Supplier360Response response =
                supplier360Service
                        .find(
                                userId,
                                supplierId
                        );

        assertEquals(
                new BigDecimal("50.00"),
                response.sourcingWinRate()
        );

        assertEquals(
                new BigDecimal("80.00"),
                response.categorySpend()
                        .getFirst()
                        .sharePercent()
        );

        assertEquals(
                new BigDecimal("20.00"),
                response.categorySpend()
                        .getLast()
                        .sharePercent()
        );
    }
}
