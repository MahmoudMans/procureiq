package com.procureiq.strategyexecution;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Component
public class StrategyExecutionMathService {

    public BigDecimal expectedProgress(
            LocalDate plannedStart,
            LocalDate plannedEnd,
            LocalDate asOf
    ) {
        if (
                asOf.isBefore(
                        plannedStart
                )
        ) {
            return zero();
        }

        if (
                !asOf.isBefore(
                        plannedEnd
                )
        ) {
            return hundred();
        }

        long totalDays =
                Math.max(
                        1,
                        ChronoUnit.DAYS
                                .between(
                                        plannedStart,
                                        plannedEnd
                                )
                );

        long elapsedDays =
                Math.max(
                        0,
                        ChronoUnit.DAYS
                                .between(
                                        plannedStart,
                                        asOf
                                )
                );

        return BigDecimal
                .valueOf(
                        elapsedDays
                )
                .multiply(
                        hundred()
                )
                .divide(
                        BigDecimal.valueOf(
                                totalDays
                        ),
                        2,
                        RoundingMode.HALF_UP
                )
                .max(
                        zero()
                )
                .min(
                        hundred()
                );
    }

    public ExecutionCommitmentHealth commitmentHealth(
            ExecutionCommitmentStatus status,
            BigDecimal progressPct,
            LocalDate plannedStart,
            LocalDate plannedEnd,
            LocalDate forecastEnd,
            int blockerCount,
            LocalDate asOf
    ) {
        if (
                status
                        == ExecutionCommitmentStatus.COMPLETED
        ) {
            return ExecutionCommitmentHealth.COMPLETED;
        }

        if (
                status
                        == ExecutionCommitmentStatus.CANCELLED
        ) {
            return ExecutionCommitmentHealth.CANCELLED;
        }

        BigDecimal progress =
                bounded(
                        progressPct
                );

        if (blockerCount > 0) {
            return ExecutionCommitmentHealth.BLOCKED;
        }

        if (
                asOf.isAfter(
                        plannedEnd
                )
                &&
                progress.compareTo(
                        hundred()
                ) < 0
        ) {
            return ExecutionCommitmentHealth.OVERDUE;
        }

        if (
                forecastEnd != null
                &&
                forecastEnd.isAfter(
                        plannedEnd
                )
        ) {
            return ExecutionCommitmentHealth.AT_RISK;
        }

        if (
                status
                        == ExecutionCommitmentStatus.PLANNED
                &&
                asOf.isBefore(
                        plannedStart
                )
        ) {
            return ExecutionCommitmentHealth.NOT_STARTED;
        }

        BigDecimal expected =
                expectedProgress(
                        plannedStart,
                        plannedEnd,
                        asOf
                );

        BigDecimal variance =
                expected.subtract(
                        progress
                );

        if (
                variance.compareTo(
                        new BigDecimal(
                                "25.00"
                        )
                ) >= 0
        ) {
            return ExecutionCommitmentHealth.AT_RISK;
        }

        if (
                variance.compareTo(
                        new BigDecimal(
                                "10.00"
                        )
                ) >= 0
        ) {
            return ExecutionCommitmentHealth.WATCH;
        }

        return ExecutionCommitmentHealth.ON_TRACK;
    }

    public BigDecimal healthScore(
            ExecutionCommitmentHealth health
    ) {
        return switch (
                health
        ) {
            case COMPLETED,
                 ON_TRACK,
                 NOT_STARTED ->
                    hundred();

            case WATCH ->
                    new BigDecimal(
                            "75.00"
                    );

            case AT_RISK ->
                    new BigDecimal(
                            "40.00"
                    );

            case BLOCKED ->
                    new BigDecimal(
                            "20.00"
                    );

            case OVERDUE ->
                    zero();

            case CANCELLED ->
                    hundred();
        };
    }

    public ExecutionPortfolioResult portfolio(
            List<ExecutionCommitmentMetric> metrics
    ) {
        List<ExecutionCommitmentMetric> active =
                metrics.stream()
                        .filter(
                                metric ->
                                        metric.status()
                                                != ExecutionCommitmentStatus.CANCELLED
                        )
                        .toList();

        if (active.isEmpty()) {
            return new ExecutionPortfolioResult(
                    zero(),
                    hundred(),
                    hundred(),
                    zero(),
                    zero(),
                    ExecutionPortfolioHealth.CRITICAL
            );
        }

        BigDecimal averageProgress =
                active.stream()
                        .map(
                                metric ->
                                        metric.status()
                                                == ExecutionCommitmentStatus.COMPLETED
                                                ? hundred()
                                                : bounded(
                                                        metric.progressPct()
                                                )
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .divide(
                                BigDecimal.valueOf(
                                        active.size()
                                ),
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal scheduleHealth =
                active.stream()
                        .map(
                                metric ->
                                        healthScore(
                                                metric.health()
                                        )
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .divide(
                                BigDecimal.valueOf(
                                        active.size()
                                ),
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal completedPlanned =
                active.stream()
                        .filter(
                                metric ->
                                        metric.status()
                                                == ExecutionCommitmentStatus.COMPLETED
                        )
                        .map(
                                ExecutionCommitmentMetric::
                                        plannedContributionPoints
                        )
                        .map(
                                this::decimal
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal completedValidated =
                active.stream()
                        .filter(
                                metric ->
                                        metric.status()
                                                == ExecutionCommitmentStatus.COMPLETED
                        )
                        .map(
                                ExecutionCommitmentMetric::
                                        validatedContributionPoints
                        )
                        .map(
                                this::decimal
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal outcomeValidation =
                completedPlanned.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? hundred()
                        : completedValidated
                                .multiply(
                                        hundred()
                                )
                                .divide(
                                        completedPlanned,
                                        2,
                                        RoundingMode.HALF_UP
                                )
                                .max(
                                        zero()
                                )
                                .min(
                                        hundred()
                                );

        BigDecimal executionScore =
                averageProgress
                        .multiply(
                                new BigDecimal(
                                        "0.45"
                                )
                        )
                        .add(
                                scheduleHealth
                                        .multiply(
                                                new BigDecimal(
                                                        "0.35"
                                                )
                                        )
                        )
                        .add(
                                outcomeValidation
                                        .multiply(
                                                new BigDecimal(
                                                        "0.20"
                                                )
                                        )
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        )
                        .max(
                                zero()
                        )
                        .min(
                                hundred()
                        );

        BigDecimal valueAtRisk =
                active.stream()
                        .map(
                                this::valueAtRisk
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        return new ExecutionPortfolioResult(
                averageProgress,
                scheduleHealth,
                outcomeValidation,
                executionScore,
                valueAtRisk,
                portfolioHealth(
                        executionScore
                )
        );
    }

    public BigDecimal valueAtRisk(
            ExecutionCommitmentMetric metric
    ) {
        BigDecimal planned =
                decimal(
                        metric.plannedContributionPoints()
                );

        if (
                metric.status()
                        == ExecutionCommitmentStatus.CANCELLED
        ) {
            return zero();
        }

        if (
                metric.status()
                        == ExecutionCommitmentStatus.COMPLETED
        ) {
            return planned
                    .subtract(
                            decimal(
                                    metric.validatedContributionPoints()
                            )
                    )
                    .max(
                            zero()
                    );
        }

        if (
                metric.health()
                        != ExecutionCommitmentHealth.AT_RISK
                &&
                metric.health()
                        != ExecutionCommitmentHealth.BLOCKED
                &&
                metric.health()
                        != ExecutionCommitmentHealth.OVERDUE
        ) {
            return zero();
        }

        BigDecimal remainingPct =
                hundred()
                        .subtract(
                                bounded(
                                        metric.progressPct()
                                )
                        )
                        .max(
                                zero()
                        );

        return planned
                .multiply(
                        remainingPct
                )
                .divide(
                        hundred(),
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public ExecutionPortfolioHealth portfolioHealth(
            BigDecimal score
    ) {
        BigDecimal normalized =
                bounded(
                        score
                );

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "85.00"
                        )
                ) >= 0
        ) {
            return ExecutionPortfolioHealth.HEALTHY;
        }

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "70.00"
                        )
                ) >= 0
        ) {
            return ExecutionPortfolioHealth.WATCH;
        }

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            return ExecutionPortfolioHealth.AT_RISK;
        }

        return ExecutionPortfolioHealth.CRITICAL;
    }

    public BigDecimal bounded(
            BigDecimal value
    ) {
        return decimal(
                value
        )
                .max(
                        zero()
                )
                .min(
                        hundred()
                );
    }

    public BigDecimal decimal(
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

    private BigDecimal hundred() {
        return new BigDecimal(
                "100.00"
        );
    }
}
