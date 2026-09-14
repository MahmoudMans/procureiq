package com.procureiq.controltower;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

@Component
public class ControlTowerPriorityService {

    public ControlTowerPriorityResult evaluate(
            ControlTowerSourceException source,
            Instant now
    ) {
        LocalDate today =
                now
                        .atZone(
                                ZoneOffset.UTC
                        )
                        .toLocalDate();

        BigDecimal score =
                severityPoints(
                        source.sourceSeverity()
                )
                        .add(
                                typeBoost(
                                        source.exceptionType()
                                )
                        )
                        .add(
                                urgencyBoost(
                                        source.sourceDueDate(),
                                        today
                                )
                        )
                        .add(
                                exposureBoost(
                                        source.monetaryExposure()
                                )
                        )
                        .min(
                                new BigDecimal(
                                        "100.00"
                                )
                        )
                        .max(
                                BigDecimal.ZERO
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        ControlTowerSeverity finalSeverity =
                severityForScore(
                        score,
                        source.sourceSeverity()
                );

        Instant defaultDueAt =
                now.plus(
                        slaDays(
                                finalSeverity
                        ),
                        ChronoUnit.DAYS
                );

        Instant slaDueAt =
                defaultDueAt;

        if (
                source.sourceDueDate()
                        != null
        ) {
            Instant sourceDueAt =
                    source
                            .sourceDueDate()
                            .atStartOfDay(
                                    ZoneOffset.UTC
                            )
                            .toInstant();

            if (
                    sourceDueAt.isBefore(
                            defaultDueAt
                    )
            ) {
                slaDueAt =
                        sourceDueAt;
            }
        }

        return new ControlTowerPriorityResult(
                score,
                finalSeverity,
                slaDueAt
        );
    }

    private BigDecimal severityPoints(
            ControlTowerSeverity severity
    ) {
        return switch (
                severity
        ) {
            case LOW ->
                    value(
                            20
                    );

            case MEDIUM ->
                    value(
                            40
                    );

            case HIGH ->
                    value(
                            60
                    );

            case CRITICAL ->
                    value(
                            80
                    );
        };
    }

    private BigDecimal typeBoost(
            ControlTowerExceptionType type
    ) {
        return switch (
                type
        ) {
            case BENEFIT_LEAKAGE,
                 COMMERCIAL_LEAKAGE ->
                    value(
                            10
                    );

            case SUPPLIER_RISK_ALERT,
                 RISK_ESCALATION_OVERDUE,
                 DOCUMENT_COMPLIANCE_GAP ->
                    value(
                            8
                    );

            case GOVERNANCE_DECISION_OVERDUE,
                 GOVERNANCE_ACTION_OVERDUE ->
                    value(
                            7
                    );

            case BENEFIT_VALIDATION_PENDING ->
                    value(
                            6
                    );

            case SOURCING_INITIATIVE_OVERDUE ->
                    value(
                            5
                    );
        };
    }

    private BigDecimal urgencyBoost(
            LocalDate dueDate,
            LocalDate today
    ) {
        if (
                dueDate == null
                ||
                !dueDate.isBefore(
                        today
                )
        ) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        long daysOverdue =
                ChronoUnit.DAYS.between(
                        dueDate,
                        today
                );

        return BigDecimal
                .valueOf(
                        Math.min(
                                15,
                                Math.max(
                                        2,
                                        daysOverdue
                                                * 2
                                )
                        )
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal exposureBoost(
            BigDecimal monetaryExposure
    ) {
        BigDecimal exposure =
                monetaryExposure == null
                        ? BigDecimal.ZERO
                        : monetaryExposure;

        if (
                exposure.compareTo(
                        new BigDecimal(
                                "100000.00"
                        )
                ) >= 0
        ) {
            return value(
                    10
            );
        }

        if (
                exposure.compareTo(
                        new BigDecimal(
                                "25000.00"
                        )
                ) >= 0
        ) {
            return value(
                    7
            );
        }

        if (
                exposure.compareTo(
                        new BigDecimal(
                                "5000.00"
                        )
                ) >= 0
        ) {
            return value(
                    4
            );
        }

        if (
                exposure.compareTo(
                        BigDecimal.ZERO
                ) > 0
        ) {
            return value(
                    2
            );
        }

        return BigDecimal.ZERO
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private ControlTowerSeverity severityForScore(
            BigDecimal score,
            ControlTowerSeverity sourceSeverity
    ) {
        ControlTowerSeverity scoreSeverity;

        if (
                score.compareTo(
                        new BigDecimal(
                                "80.00"
                        )
                ) >= 0
        ) {
            scoreSeverity =
                    ControlTowerSeverity.CRITICAL;
        } else if (
                score.compareTo(
                        new BigDecimal(
                                "60.00"
                        )
                ) >= 0
        ) {
            scoreSeverity =
                    ControlTowerSeverity.HIGH;
        } else if (
                score.compareTo(
                        new BigDecimal(
                                "40.00"
                        )
                ) >= 0
        ) {
            scoreSeverity =
                    ControlTowerSeverity.MEDIUM;
        } else {
            scoreSeverity =
                    ControlTowerSeverity.LOW;
        }

        return scoreSeverity.ordinal()
                        >= sourceSeverity.ordinal()
                ? scoreSeverity
                : sourceSeverity;
    }

    private long slaDays(
            ControlTowerSeverity severity
    ) {
        return switch (
                severity
        ) {
            case CRITICAL ->
                    1;

            case HIGH ->
                    3;

            case MEDIUM ->
                    7;

            case LOW ->
                    14;
        };
    }

    private BigDecimal value(
            int value
    ) {
        return BigDecimal
                .valueOf(
                        value
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }
}
