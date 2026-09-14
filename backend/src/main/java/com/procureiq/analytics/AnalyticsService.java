package com.procureiq.analytics;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class AnalyticsService {

    private static final BigDecimal HUNDRED =
            new BigDecimal("100.00");

    private final AnalyticsRepository
            analyticsRepository;

    private final AppUserRepository
            appUserRepository;

    public AnalyticsService(
            AnalyticsRepository analyticsRepository,
            AppUserRepository appUserRepository
    ) {
        this.analyticsRepository =
                analyticsRepository;

        this.appUserRepository =
                appUserRepository;
    }

    public ProcurementAnalyticsResponse getAnalytics(
            UUID currentUserId
    ) {
        AppUserEntity user =
                appUserRepository
                        .findById(
                                currentUserId
                        )
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Authenticated ProcureIQ user not found."
                                        )
                        );

        if (!user.isActive()) {
            throw new IllegalArgumentException(
                    "The authenticated ProcureIQ account is inactive."
            );
        }

        assertAnalyticsRole(
                user.getRole()
        );

        BigDecimal committedSpend =
                analyticsRepository
                        .committedSpend()
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        long committedOrders =
                analyticsRepository
                        .committedOrderCount();

        BigDecimal averageOrderValue =
                committedOrders == 0
                        ? BigDecimal.ZERO
                                .setScale(2)
                        : committedSpend
                                .divide(
                                        BigDecimal.valueOf(
                                                committedOrders
                                        ),
                                        2,
                                        RoundingMode.HALF_UP
                                );

        AnalyticsSummaryResponse summary =
                new AnalyticsSummaryResponse(
                        committedSpend,
                        committedOrders,
                        analyticsRepository
                                .activeSupplierCount(),
                        analyticsRepository
                                .sourcingSavings()
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                ),
                        analyticsRepository
                                .averageProcurementCycleDays()
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                ),
                        averageOrderValue,
                        analyticsRepository
                                .openDeliveryOrders(),
                        analyticsRepository
                                .overdueDeliveryOrders()
                );

        List<MonthlySpendResponse> monthlySpend =
                analyticsRepository
                        .monthlySpend()
                        .stream()
                        .map(
                                row ->
                                        new MonthlySpendResponse(
                                                row.month(),
                                                row.amount(),
                                                row.orderCount()
                                        )
                        )
                        .toList();

        return new ProcurementAnalyticsResponse(
                summary,
                monthlySpend,
                withShare(
                        analyticsRepository
                                .spendBySupplier()
                ),
                withShare(
                        analyticsRepository
                                .spendByCategory()
                ),
                withShare(
                        analyticsRepository
                                .spendByDepartment()
                ),
                withShare(
                        analyticsRepository
                                .riskExposure()
                ),
                withShare(
                        analyticsRepository
                                .purchaseOrderPipeline()
                )
        );
    }

    private List<AnalyticsBreakdownResponse> withShare(
            List<AnalyticsRepository.ValueRow> rows
    ) {
        BigDecimal total =
                rows.stream()
                        .map(
                                AnalyticsRepository.ValueRow::
                                        value
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        return rows.stream()
                .map(
                        row ->
                                new AnalyticsBreakdownResponse(
                                        row.label(),
                                        row.value(),
                                        row.count(),
                                        share(
                                                row.value(),
                                                total
                                        )
                                )
                )
                .toList();
    }

    private BigDecimal share(
            BigDecimal value,
            BigDecimal total
    ) {
        if (
                total.compareTo(
                        BigDecimal.ZERO
                ) == 0
        ) {
            return BigDecimal.ZERO
                    .setScale(2);
        }

        return value
                .multiply(
                        HUNDRED
                )
                .divide(
                        total,
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private void assertAnalyticsRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.BUYER
                &&
                role != ProcurementRole.APPROVER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot access procurement analytics."
            );
        }
    }
}
