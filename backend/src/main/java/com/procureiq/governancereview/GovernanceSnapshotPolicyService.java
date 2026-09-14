package com.procureiq.governancereview;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class GovernanceSnapshotPolicyService {

    public GovernanceSeverity supplierRiskSeverity(
            String riskBand
    ) {
        if ("CRITICAL".equals(riskBand)) {
            return GovernanceSeverity.CRITICAL;
        }

        if ("HIGH".equals(riskBand)) {
            return GovernanceSeverity.HIGH;
        }

        if ("MODERATE".equals(riskBand)) {
            return GovernanceSeverity.MEDIUM;
        }

        return GovernanceSeverity.INFO;
    }

    public GovernanceSeverity categorySeverity(
            String matrixPosition
    ) {
        if ("CRITICAL_PRIORITY".equals(matrixPosition)) {
            return GovernanceSeverity.CRITICAL;
        }

        if (
                "RISK_MITIGATION".equals(
                        matrixPosition
                )
        ) {
            return GovernanceSeverity.HIGH;
        }

        if (
                "VALUE_OPTIMIZATION".equals(
                        matrixPosition
                )
        ) {
            return GovernanceSeverity.MEDIUM;
        }

        return GovernanceSeverity.INFO;
    }

    public GovernanceSeverity portfolioSeverity(
            BigDecimal target,
            BigDecimal forecast,
            BigDecimal leakage
    ) {
        BigDecimal normalizedTarget =
                money(
                        target
                );

        BigDecimal normalizedForecast =
                money(
                        forecast
                );

        BigDecimal normalizedLeakage =
                money(
                        leakage
                );

        BigDecimal atRisk =
                normalizedTarget
                        .subtract(
                                normalizedForecast
                        )
                        .max(
                                BigDecimal.ZERO
                        )
                        .add(
                                normalizedLeakage
                        );

        if (
                normalizedTarget.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return atRisk.compareTo(
                    BigDecimal.ZERO
            ) > 0
                    ? GovernanceSeverity.HIGH
                    : GovernanceSeverity.INFO;
        }

        BigDecimal pct =
                atRisk
                        .multiply(
                                new BigDecimal(
                                        "100.00"
                                )
                        )
                        .divide(
                                normalizedTarget,
                                2,
                                RoundingMode.HALF_UP
                        );

        if (
                pct.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            return GovernanceSeverity.CRITICAL;
        }

        if (
                pct.compareTo(
                        new BigDecimal(
                                "25.00"
                        )
                ) >= 0
        ) {
            return GovernanceSeverity.HIGH;
        }

        if (
                atRisk.compareTo(
                        BigDecimal.ZERO
                ) > 0
        ) {
            return GovernanceSeverity.MEDIUM;
        }

        return GovernanceSeverity.INFO;
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
}
