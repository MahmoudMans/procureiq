package com.procureiq.flywheelremediation;

import com.procureiq.flywheelvariance.FlywheelVarianceDecision;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

@Service
public class FlywheelResidualRemediationPolicyService {

    private static final BigDecimal ZERO =
            new BigDecimal("0.00");

    public void validateItem(
            FlywheelVarianceDecision sourceDecision,
            BigDecimal residualAmount,
            FlywheelResidualRemediationAction action,
            LocalDate targetDate,
            String rationale,
            LocalDate today
    ) {
        if (sourceDecision == null) {
            throw new IllegalArgumentException(
                    "Source variance decision is required."
            );
        }

        BigDecimal residual =
                money(
                        residualAmount,
                        "Residual amount"
                );

        if (residual.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Only positive financial residual requires remediation."
            );
        }

        if (action == null) {
            throw new IllegalArgumentException(
                    "Remediation action is required."
            );
        }

        if (targetDate == null) {
            throw new IllegalArgumentException(
                    "Target date is required."
            );
        }

        if (today == null) {
            throw new IllegalArgumentException(
                    "Current date is required."
            );
        }

        if (targetDate.isBefore(today)) {
            throw new IllegalArgumentException(
                    "Target date cannot be in the past."
            );
        }

        if (
                rationale == null
                ||
                rationale.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Remediation rationale is required."
            );
        }

        if (rationale.length() > 2500) {
            throw new IllegalArgumentException(
                    "Remediation rationale cannot exceed 2500 characters."
            );
        }
    }

    public FlywheelResidualRemediationMetricResult metrics(
            List<FlywheelResidualRemediationMetricInput> items
    ) {
        if (items == null) {
            throw new IllegalArgumentException(
                    "Metric items are required."
            );
        }

        BigDecimal covered = ZERO;
        BigDecimal recovery = ZERO;
        BigDecimal writeOff = ZERO;
        BigDecimal investigation = ZERO;
        BigDecimal acceptance = ZERO;

        for (
                FlywheelResidualRemediationMetricInput item
                : items
        ) {
            if (item == null) {
                throw new IllegalArgumentException(
                        "Metric item cannot be null."
                );
            }

            BigDecimal residual =
                    money(
                            item.residualAmount(),
                            "Residual amount"
                    );

            if (residual.signum() <= 0) {
                throw new IllegalArgumentException(
                        "Metric residual must be positive."
                );
            }

            if (item.action() == null) {
                throw new IllegalArgumentException(
                        "Metric action is required."
                );
            }

            covered =
                    covered.add(
                            residual
                    );

            switch (
                    item.action()
            ) {
                case RECOVERY_FOLLOW_UP ->
                        recovery =
                                recovery.add(
                                        residual
                                );

                case WRITE_OFF_REVIEW ->
                        writeOff =
                                writeOff.add(
                                        residual
                                );

                case INVESTIGATION_ESCALATION ->
                        investigation =
                                investigation.add(
                                        residual
                                );

                case RESIDUAL_ACCEPTANCE_REVIEW ->
                        acceptance =
                                acceptance.add(
                                        residual
                                );
            }
        }

        return new FlywheelResidualRemediationMetricResult(
                covered,
                recovery,
                writeOff,
                investigation,
                acceptance,
                items.size()
        );
    }

    private BigDecimal money(
            BigDecimal value,
            String label
    ) {
        if (value == null) {
            throw new IllegalArgumentException(
                    label + " is required."
            );
        }

        try {
            return value.setScale(
                    2,
                    RoundingMode.UNNECESSARY
            );

        } catch (
                ArithmeticException exception
        ) {
            throw new IllegalArgumentException(
                    label
                            + " must use exact cents.",
                    exception
            );
        }
    }
}
