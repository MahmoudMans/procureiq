package com.procureiq.interventionexecution;

import com.procureiq.investmentintervention.InvestmentInterventionAction;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class InterventionExecutionMathService {

    public InterventionExecutionMetricResult metrics(
            InvestmentInterventionAction action,
            BigDecimal approvedAffectedCapitalAmount,
            List<BigDecimal> implementedAmounts,
            InterventionExecutionStatus status
    ) {
        BigDecimal approved =
                money(
                        approvedAffectedCapitalAmount
                );

        BigDecimal implemented =
                implementedAmounts.stream()
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
                                implemented
                        )
                        .max(
                                zero()
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal implementationPct;

        if (
                action
                        == InvestmentInterventionAction.CONTINUE
        ) {
            implementationPct =
                    implementedAmounts.isEmpty()
                            ? zero()
                            : hundred();
        } else if (
                approved.compareTo(
                        BigDecimal.ZERO
                )
                <= 0
        ) {
            implementationPct =
                    zero();
        } else {
            implementationPct =
                    implemented
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
        }

        BigDecimal variance =
                implemented
                        .subtract(
                                approved
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        InterventionExecutionHealth health;

        if (
                status
                        == InterventionExecutionStatus.REMEDIATION_REQUIRED
        ) {
            health =
                    InterventionExecutionHealth.REMEDIATION_REQUIRED;
        } else if (
                implementedAmounts.isEmpty()
        ) {
            health =
                    InterventionExecutionHealth.NOT_STARTED;
        } else if (
                implementationPct.compareTo(
                        hundred()
                ) == 0
        ) {
            health =
                    InterventionExecutionHealth.COMPLETE;
        } else if (
                status
                        == InterventionExecutionStatus.READY_FOR_VERIFICATION
        ) {
            health =
                    InterventionExecutionHealth.VARIANCE;
        } else {
            health =
                    InterventionExecutionHealth.IN_PROGRESS;
        }

        return new InterventionExecutionMetricResult(
                approved,
                implemented,
                remaining,
                implementationPct,
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
