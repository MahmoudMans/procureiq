package com.procureiq.operatingrhythm;

import com.procureiq.controltower.ControlTowerExceptionType;
import com.procureiq.controltower.ControlTowerItemStatus;
import com.procureiq.controltower.ControlTowerSeverity;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class OperatingRhythmAnalyticsService {

    private static final long PERSISTENT_DAYS =
            7L;

    public OperatingRhythmAnalysis analyze(
            List<OperatingRhythmSourceItem> items,
            LocalDate periodStart,
            LocalDate periodEnd,
            Instant now
    ) {
        if (
                periodEnd.isBefore(
                        periodStart
                )
        ) {
            throw new IllegalArgumentException(
                    "Operating-rhythm period end cannot precede period start."
            );
        }

        Instant periodStartAt =
                periodStart
                        .atStartOfDay(
                                ZoneOffset.UTC
                        )
                        .toInstant();

        Instant periodEndExclusive =
                periodEnd
                        .plusDays(
                                1
                        )
                        .atStartOfDay(
                                ZoneOffset.UTC
                        )
                        .toInstant();

        List<OperatingRhythmSourceItem> relevant =
                items.stream()
                        .filter(
                                item ->
                                        isActive(
                                                item
                                        )
                                        ||
                                        isResolvedInPeriod(
                                                item,
                                                periodStartAt,
                                                periodEndExclusive
                                        )
                        )
                        .toList();

        OperatingRhythmMetrics metrics =
                metrics(
                        relevant,
                        periodStartAt,
                        periodEndExclusive,
                        now
                );

        List<OperatingRhythmDimensionMetric> dimensions =
                new ArrayList<>();

        dimensions.addAll(
                dimensions(
                        relevant,
                        OperatingRhythmDimensionType.DOMAIN,
                        metrics.activeBacklogCount(),
                        periodStartAt,
                        periodEndExclusive,
                        now
                )
        );

        dimensions.addAll(
                dimensions(
                        relevant,
                        OperatingRhythmDimensionType.OWNER,
                        metrics.activeBacklogCount(),
                        periodStartAt,
                        periodEndExclusive,
                        now
                )
        );

        dimensions.addAll(
                dimensions(
                        relevant,
                        OperatingRhythmDimensionType.SEVERITY,
                        metrics.activeBacklogCount(),
                        periodStartAt,
                        periodEndExclusive,
                        now
                )
        );

        dimensions.addAll(
                dimensions(
                        relevant,
                        OperatingRhythmDimensionType.EXCEPTION_TYPE,
                        metrics.activeBacklogCount(),
                        periodStartAt,
                        periodEndExclusive,
                        now
                )
        );

        return new OperatingRhythmAnalysis(
                metrics,
                List.copyOf(
                        dimensions
                )
        );
    }

    private List<OperatingRhythmDimensionMetric> dimensions(
            List<OperatingRhythmSourceItem> items,
            OperatingRhythmDimensionType dimensionType,
            long totalActive,
            Instant periodStart,
            Instant periodEndExclusive,
            Instant now
    ) {
        Map<String, DimensionBucket> buckets =
                new LinkedHashMap<>();

        for (
                OperatingRhythmSourceItem item
                : items
        ) {
            DimensionIdentity identity =
                    identity(
                            item,
                            dimensionType
                    );

            buckets
                    .computeIfAbsent(
                            identity.key(),
                            ignored ->
                                    new DimensionBucket(
                                            identity
                                    )
                    )
                    .items()
                    .add(
                            item
                    );
        }

        return buckets
                .values()
                .stream()
                .map(
                        bucket -> {
                            OperatingRhythmMetrics metrics =
                                    metrics(
                                            bucket.items(),
                                            periodStart,
                                            periodEndExclusive,
                                            now
                                    );

                            BigDecimal workloadShare =
                                    totalActive == 0
                                            ? zero()
                                            : BigDecimal
                                                    .valueOf(
                                                            metrics.activeBacklogCount()
                                                    )
                                                    .multiply(
                                                            new BigDecimal(
                                                                    "100.00"
                                                            )
                                                    )
                                                    .divide(
                                                            BigDecimal.valueOf(
                                                                    totalActive
                                                            ),
                                                            2,
                                                            RoundingMode.HALF_UP
                                                    );

                            return new OperatingRhythmDimensionMetric(
                                    dimensionType,
                                    bucket.identity()
                                            .key(),
                                    bucket.identity()
                                            .label(),
                                    metrics.activeBacklogCount(),
                                    metrics.slaOverdueCount(),
                                    metrics.persistentExceptionCount(),
                                    metrics.resolvedCount(),
                                    metrics.onTimeResolvedCount(),
                                    metrics.slaAttainmentPct(),
                                    metrics.avgResolutionHours(),
                                    metrics.avgActiveAgeDays(),
                                    metrics.activeMonetaryExposure(),
                                    workloadShare
                            );
                        }
                )
                .sorted(
                        Comparator
                                .comparingLong(
                                        OperatingRhythmDimensionMetric::
                                                activeCount
                                )
                                .reversed()
                                .thenComparing(
                                        OperatingRhythmDimensionMetric::
                                                dimensionLabel
                                )
                )
                .toList();
    }

    private OperatingRhythmMetrics metrics(
            List<OperatingRhythmSourceItem> items,
            Instant periodStart,
            Instant periodEndExclusive,
            Instant now
    ) {
        List<OperatingRhythmSourceItem> active =
                items.stream()
                        .filter(
                                this::isActive
                        )
                        .toList();

        List<OperatingRhythmSourceItem> resolved =
                items.stream()
                        .filter(
                                item ->
                                        isResolvedInPeriod(
                                                item,
                                                periodStart,
                                                periodEndExclusive
                                        )
                        )
                        .toList();

        long onTime =
                resolved.stream()
                        .filter(
                                item ->
                                        item.resolvedAt()
                                                != null
                                        &&
                                        !item.resolvedAt()
                                                .isAfter(
                                                        item.slaDueAt()
                                                )
                        )
                        .count();

        long late =
                resolved.size()
                        -
                        onTime;

        long slaOverdue =
                active.stream()
                        .filter(
                                item ->
                                        item.slaDueAt()
                                                .isBefore(
                                                        now
                                                )
                        )
                        .count();

        long persistent =
                active.stream()
                        .filter(
                                item ->
                                        Duration.between(
                                                item.firstSeenAt(),
                                                now
                                        )
                                                .toDays()
                                        >= PERSISTENT_DAYS
                        )
                        .count();

        BigDecimal exposure =
                active.stream()
                        .map(
                                OperatingRhythmSourceItem::
                                        monetaryExposure
                        )
                        .filter(
                                value ->
                                        value != null
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal slaAttainment =
                resolved.isEmpty()
                        ? zero()
                        : BigDecimal
                                .valueOf(
                                        onTime
                                )
                                .multiply(
                                        new BigDecimal(
                                                "100.00"
                                        )
                                )
                                .divide(
                                        BigDecimal.valueOf(
                                                resolved.size()
                                        ),
                                        2,
                                        RoundingMode.HALF_UP
                                );

        BigDecimal avgResolutionHours =
                average(
                        resolved.stream()
                                .filter(
                                        item ->
                                                item.resolvedAt()
                                                        != null
                                )
                                .mapToDouble(
                                        item ->
                                                Duration.between(
                                                        item.firstSeenAt(),
                                                        item.resolvedAt()
                                                )
                                                        .toMinutes()
                                                /
                                                60.0
                                )
                                .toArray()
                );

        BigDecimal avgActiveAgeDays =
                average(
                        active.stream()
                                .mapToDouble(
                                        item ->
                                                Duration.between(
                                                        item.firstSeenAt(),
                                                        now
                                                )
                                                        .toMinutes()
                                                /
                                                1440.0
                                )
                                .toArray()
                );

        return new OperatingRhythmMetrics(
                active.size(),
                active.stream()
                        .filter(
                                item ->
                                        item.severity()
                                                == ControlTowerSeverity.CRITICAL
                        )
                        .count(),
                active.stream()
                        .filter(
                                item ->
                                        item.severity()
                                                == ControlTowerSeverity.HIGH
                        )
                        .count(),
                slaOverdue,
                active.stream()
                        .filter(
                                item ->
                                        item.ownerUserId()
                                                == null
                        )
                        .count(),
                persistent,
                resolved.size(),
                onTime,
                late,
                slaAttainment,
                avgResolutionHours,
                avgActiveAgeDays,
                money(
                        exposure
                )
        );
    }

    private boolean isActive(
            OperatingRhythmSourceItem item
    ) {
        return item.status()
                        == ControlTowerItemStatus.OPEN
                ||
                item.status()
                        == ControlTowerItemStatus.ACKNOWLEDGED
                ||
                item.status()
                        == ControlTowerItemStatus.IN_PROGRESS;
    }

    private boolean isResolvedInPeriod(
            OperatingRhythmSourceItem item,
            Instant periodStart,
            Instant periodEndExclusive
    ) {
        return item.status()
                        == ControlTowerItemStatus.RESOLVED
                &&
                item.resolvedAt()
                        != null
                &&
                !item.resolvedAt()
                        .isBefore(
                                periodStart
                        )
                &&
                item.resolvedAt()
                        .isBefore(
                                periodEndExclusive
                        );
    }

    private DimensionIdentity identity(
            OperatingRhythmSourceItem item,
            OperatingRhythmDimensionType dimensionType
    ) {
        return switch (
                dimensionType
        ) {
            case DOMAIN ->
                    domainIdentity(
                            item.exceptionType()
                    );

            case OWNER ->
                    item.ownerUserId()
                                    == null
                            ? new DimensionIdentity(
                                    "UNASSIGNED",
                                    "Unassigned"
                            )
                            : new DimensionIdentity(
                                    item.ownerUserId()
                                            .toString(),
                                    item.ownerName()
                                            == null
                                                    ||
                                                    item.ownerName()
                                                        .isBlank()
                                            ? "Unknown owner"
                                            : item.ownerName()
                            );

            case SEVERITY ->
                    new DimensionIdentity(
                            item.severity()
                                    .name(),
                            readable(
                                    item.severity()
                                            .name()
                            )
                    );

            case EXCEPTION_TYPE ->
                    new DimensionIdentity(
                            item.exceptionType()
                                    .name(),
                            readable(
                                    item.exceptionType()
                                            .name()
                            )
                    );
        };
    }

    private DimensionIdentity domainIdentity(
            ControlTowerExceptionType type
    ) {
        return switch (
                type
        ) {
            case SUPPLIER_RISK_ALERT,
                 RISK_ESCALATION_OVERDUE ->
                    new DimensionIdentity(
                            "SUPPLIER_RISK",
                            "Supplier risk"
                    );

            case DOCUMENT_COMPLIANCE_GAP ->
                    new DimensionIdentity(
                            "COMPLIANCE",
                            "Supplier compliance"
                    );

            case SOURCING_INITIATIVE_OVERDUE ->
                    new DimensionIdentity(
                            "SOURCING",
                            "Sourcing execution"
                    );

            case BENEFIT_VALIDATION_PENDING,
                 BENEFIT_LEAKAGE,
                 COMMERCIAL_LEAKAGE ->
                    new DimensionIdentity(
                            "VALUE_REALIZATION",
                            "Value realization"
                    );

            case GOVERNANCE_DECISION_OVERDUE,
                 GOVERNANCE_ACTION_OVERDUE ->
                    new DimensionIdentity(
                            "GOVERNANCE",
                            "Executive governance"
                    );
        };
    }

    private String readable(
            String value
    ) {
        String[] words =
                value
                        .toLowerCase()
                        .split(
                                "_"
                        );

        StringBuilder builder =
                new StringBuilder();

        for (
                String word
                : words
        ) {
            if (
                    builder.length()
                            > 0
            ) {
                builder.append(
                        " "
                );
            }

            builder.append(
                    Character.toUpperCase(
                            word.charAt(
                                    0
                            )
                    )
            );

            builder.append(
                    word.substring(
                            1
                    )
            );
        }

        return builder.toString();
    }

    private BigDecimal average(
            double[] values
    ) {
        if (
                values.length
                        == 0
        ) {
            return zero();
        }

        double total =
                0.0;

        for (
                double value
                : values
        ) {
            total +=
                    Math.max(
                            0.0,
                            value
                    );
        }

        return BigDecimal
                .valueOf(
                        total
                        /
                        values.length
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
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

    private BigDecimal zero() {
        return BigDecimal.ZERO
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private record DimensionIdentity(
            String key,
            String label
    ) {
    }

    private record DimensionBucket(
            DimensionIdentity identity,
            List<OperatingRhythmSourceItem> items
    ) {
        private DimensionBucket(
                DimensionIdentity identity
        ) {
            this(
                    identity,
                    new ArrayList<>()
            );
        }
    }
}
