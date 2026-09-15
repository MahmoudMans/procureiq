package com.procureiq.capitalredeployment;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class CapitalRedeploymentMathService {

    public CapitalRedeploymentMetricResult metrics(
            BigDecimal approvedRedeploymentAmount,
            List<BigDecimal> releasedAmounts,
            CapitalRedeploymentStatus status
    ) {
        BigDecimal approved =
                money(
                        approvedRedeploymentAmount
                );

        BigDecimal released =
                releasedAmounts.stream()
                        .map(
                                this::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal remaining =
                approved
                        .subtract(
                                released
                        )
                        .max(
                                zero()
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal pct =
                approved.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? zero()
                        : released
                                .multiply(
                                        hundred()
                                )
                                .divide(
                                        approved,
                                        2,
                                        RoundingMode.HALF_UP
                                )
                                .max(
                                        zero()
                                )
                                .min(
                                        hundred()
                                );

        BigDecimal variance =
                released
                        .subtract(
                                approved
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        CapitalRedeploymentHealth health;

        if (
                status
                        == CapitalRedeploymentStatus.REMEDIATION_REQUIRED
        ) {
            health =
                    CapitalRedeploymentHealth.REMEDIATION_REQUIRED;
        } else if (
                releasedAmounts.isEmpty()
        ) {
            health =
                    CapitalRedeploymentHealth.NOT_STARTED;
        } else if (
                pct.compareTo(
                        hundred()
                ) == 0
        ) {
            health =
                    CapitalRedeploymentHealth.COMPLETE;
        } else if (
                status
                        == CapitalRedeploymentStatus.READY_FOR_VERIFICATION
        ) {
            health =
                    CapitalRedeploymentHealth.VARIANCE;
        } else {
            health =
                    CapitalRedeploymentHealth.IN_PROGRESS;
        }

        return new CapitalRedeploymentMetricResult(
                approved,
                released,
                remaining,
                pct,
                variance,
                health
        );
    }

    public BigDecimal averagePct(
            List<BigDecimal> values
    ) {
        if (values.isEmpty()) {
            return zero();
        }

        return values.stream()
                .map(
                        this::percent
                )
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                )
                .divide(
                        BigDecimal.valueOf(
                                values.size()
                        ),
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal money(
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

    public BigDecimal percent(
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
                )
                .max(
                        zero()
                )
                .min(
                        hundred()
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
