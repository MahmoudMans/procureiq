package com.procureiq.operatingrhythm;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class OperatingRhythmService {

    private final OperatingRhythmRepository repository;

    private final OperatingRhythmAnalyticsService analyticsService;

    private final AppUserRepository appUserRepository;

    public OperatingRhythmService(
            OperatingRhythmRepository repository,
            OperatingRhythmAnalyticsService analyticsService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.analyticsService =
                analyticsService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public OperatingRhythmDashboardResponse dashboard(
            UUID currentUserId,
            String currency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String normalizedCurrency =
                normalizeCurrency(
                        currency
                );

        LocalDate livePeriodEnd =
                LocalDate.now(
                        ZoneOffset.UTC
                );

        LocalDate livePeriodStart =
                livePeriodEnd.minusDays(
                        29
                );

        OperatingRhythmAnalysis analysis =
                analyticsService
                        .analyze(
                                repository
                                        .sourceItems(
                                                normalizedCurrency
                                        ),
                                livePeriodStart,
                                livePeriodEnd,
                                Instant.now()
                        );

        List<OperatingRhythmDimensionResponse> liveDimensions =
                analysis
                        .dimensions()
                        .stream()
                        .map(
                                this::liveDimensionResponse
                        )
                        .toList();

        return new OperatingRhythmDashboardResponse(
                normalizedCurrency,
                livePeriodStart,
                livePeriodEnd,
                metricsResponse(
                        analysis.metrics()
                ),
                filterDimensions(
                        liveDimensions,
                        OperatingRhythmDimensionType.DOMAIN
                ),
                filterDimensions(
                        liveDimensions,
                        OperatingRhythmDimensionType.OWNER
                ),
                filterDimensions(
                        liveDimensions,
                        OperatingRhythmDimensionType.EXCEPTION_TYPE
                ),
                repository
                        .snapshots(
                                normalizedCurrency
                        )
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public OperatingRhythmSnapshotDetailResponse captureSnapshot(
            UUID currentUserId,
            OperatingRhythmSnapshotInput input
    ) {
        assertCaptureRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                input.periodEnd()
                        .isBefore(
                                input.periodStart()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Operating-rhythm snapshot period end cannot precede its start date."
            );
        }

        String currency =
                normalizeCurrency(
                        input.currency()
                );

        OperatingRhythmAnalysis analysis =
                analyticsService
                        .analyze(
                                repository
                                        .sourceItems(
                                                currency
                                        ),
                                input.periodStart(),
                                input.periodEnd(),
                                Instant.now()
                        );

        UUID snapshotId =
                UUID.randomUUID();

        repository.insertSnapshot(
                snapshotId,
                nextSnapshotNumber(),
                currency,
                input.periodStart(),
                input.periodEnd(),
                currentUserId,
                analysis.metrics()
        );

        for (
                OperatingRhythmDimensionMetric dimension
                : analysis.dimensions()
        ) {
            repository.insertDimension(
                    snapshotId,
                    dimension
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    @Transactional(readOnly = true)
    public OperatingRhythmSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        OperatingRhythmRepository.SnapshotRow snapshot =
                requireSnapshot(
                        snapshotId
                );

        List<OperatingRhythmDimensionResponse> dimensions =
                repository
                        .dimensions(
                                snapshotId
                        )
                        .stream()
                        .map(
                                this::dimensionResponse
                        )
                        .toList();

        OperatingRhythmMetrics metrics =
                new OperatingRhythmMetrics(
                        snapshot.activeBacklogCount(),
                        snapshot.criticalBacklogCount(),
                        snapshot.highBacklogCount(),
                        snapshot.slaOverdueCount(),
                        snapshot.unassignedCount(),
                        snapshot.persistentExceptionCount(),
                        snapshot.resolvedCount(),
                        snapshot.onTimeResolvedCount(),
                        snapshot.lateResolvedCount(),
                        snapshot.slaAttainmentPct(),
                        snapshot.avgResolutionHours(),
                        snapshot.avgActiveAgeDays(),
                        snapshot.activeMonetaryExposure()
                );

        return new OperatingRhythmSnapshotDetailResponse(
                snapshotSummary(
                        snapshot
                ),
                metricsResponse(
                        metrics
                ),
                snapshot.periodStart(),
                snapshot.periodEnd(),
                filterDimensions(
                        dimensions,
                        OperatingRhythmDimensionType.DOMAIN
                ),
                filterDimensions(
                        dimensions,
                        OperatingRhythmDimensionType.OWNER
                ),
                filterDimensions(
                        dimensions,
                        OperatingRhythmDimensionType.SEVERITY
                ),
                filterDimensions(
                        dimensions,
                        OperatingRhythmDimensionType.EXCEPTION_TYPE
                )
        );
    }

    private List<OperatingRhythmDimensionResponse> filterDimensions(
            List<OperatingRhythmDimensionResponse> dimensions,
            OperatingRhythmDimensionType type
    ) {
        return dimensions.stream()
                .filter(
                        dimension ->
                                dimension.dimensionType()
                                        == type
                )
                .toList();
    }

    private OperatingRhythmMetricsResponse metricsResponse(
            OperatingRhythmMetrics metrics
    ) {
        return new OperatingRhythmMetricsResponse(
                metrics.activeBacklogCount(),
                metrics.criticalBacklogCount(),
                metrics.highBacklogCount(),
                metrics.slaOverdueCount(),
                metrics.unassignedCount(),
                metrics.persistentExceptionCount(),
                metrics.resolvedCount(),
                metrics.onTimeResolvedCount(),
                metrics.lateResolvedCount(),
                decimal(
                        metrics.slaAttainmentPct()
                ),
                decimal(
                        metrics.avgResolutionHours()
                ),
                decimal(
                        metrics.avgActiveAgeDays()
                ),
                money(
                        metrics.activeMonetaryExposure()
                )
        );
    }

    private OperatingRhythmDimensionResponse liveDimensionResponse(
            OperatingRhythmDimensionMetric dimension
    ) {
        return new OperatingRhythmDimensionResponse(
                null,
                dimension.dimensionType(),
                dimension.dimensionKey(),
                dimension.dimensionLabel(),
                dimension.activeCount(),
                dimension.slaOverdueCount(),
                dimension.persistentCount(),
                dimension.resolvedCount(),
                dimension.onTimeResolvedCount(),
                decimal(
                        dimension.slaAttainmentPct()
                ),
                decimal(
                        dimension.avgResolutionHours()
                ),
                decimal(
                        dimension.avgActiveAgeDays()
                ),
                money(
                        dimension.activeExposure()
                ),
                decimal(
                        dimension.workloadSharePct()
                )
        );
    }

    private OperatingRhythmDimensionResponse dimensionResponse(
            OperatingRhythmRepository.DimensionRow row
    ) {
        return new OperatingRhythmDimensionResponse(
                row.id(),
                row.dimensionType(),
                row.dimensionKey(),
                row.dimensionLabel(),
                row.activeCount(),
                row.slaOverdueCount(),
                row.persistentCount(),
                row.resolvedCount(),
                row.onTimeResolvedCount(),
                decimal(
                        row.slaAttainmentPct()
                ),
                decimal(
                        row.avgResolutionHours()
                ),
                decimal(
                        row.avgActiveAgeDays()
                ),
                money(
                        row.activeExposure()
                ),
                decimal(
                        row.workloadSharePct()
                )
        );
    }

    private OperatingRhythmSnapshotSummaryResponse snapshotSummary(
            OperatingRhythmRepository.SnapshotRow row
    ) {
        return new OperatingRhythmSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),
                row.currency(),
                row.periodStart(),
                row.periodEnd(),
                row.capturedByName(),
                row.activeBacklogCount(),
                row.slaOverdueCount(),
                row.persistentExceptionCount(),
                row.resolvedCount(),
                decimal(
                        row.slaAttainmentPct()
                ),
                decimal(
                        row.avgResolutionHours()
                ),
                decimal(
                        row.avgActiveAgeDays()
                ),
                money(
                        row.activeMonetaryExposure()
                ),
                row.capturedAt()
        );
    }

    private OperatingRhythmRepository.SnapshotRow requireSnapshot(
            UUID snapshotId
    ) {
        OperatingRhythmRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Operating-rhythm snapshot not found: "
                            + snapshotId
            );
        }

        return snapshot;
    }

    private String nextSnapshotNumber() {
        Long sequence =
                repository
                        .nextSnapshotSequence();

        return String.format(
                "OPS-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                sequence
        );
    }

    private String normalizeCurrency(
            String currency
    ) {
        if (
                currency == null
                ||
                currency.trim()
                        .length()
                        != 3
        ) {
            throw new IllegalArgumentException(
                    "Operating-rhythm currency must contain exactly three characters."
            );
        }

        return currency
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    private BigDecimal money(
            BigDecimal value
    ) {
        return (
                value == null
                        ? BigDecimal.ZERO
                        : value
        )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal decimal(
            BigDecimal value
    ) {
        return (
                value == null
                        ? BigDecimal.ZERO
                        : value
        )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private AppUserEntity findCurrentUser(
            UUID userId
    ) {
        AppUserEntity user =
                appUserRepository
                        .findById(
                                userId
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

        return user;
    }

    private void assertReadRole(
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
                    "Your ProcureIQ role cannot access operating-rhythm intelligence."
            );
        }
    }

    private void assertCaptureRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.BUYER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot capture operating-rhythm snapshots."
            );
        }
    }
}
