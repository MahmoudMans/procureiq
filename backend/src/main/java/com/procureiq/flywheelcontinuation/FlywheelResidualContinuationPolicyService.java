package com.procureiq.flywheelcontinuation;

import com.procureiq.flywheelremediation.FlywheelResidualRemediationAction;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

@Service
public class FlywheelResidualContinuationPolicyService {

    public void validate(
            FlywheelResidualRemediationAction sourceAction,
            BigDecimal remainingResidual,
            FlywheelResidualContinuationAction continuationAction,
            LocalDate targetDate,
            String rationale,
            LocalDate today
    ) {
        if (sourceAction == null) {
            throw new IllegalArgumentException(
                    "Source remediation action is required."
            );
        }

        BigDecimal residual =
                money(
                        remainingResidual
                );

        if (residual.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Remaining residual must be positive."
            );
        }

        if (continuationAction == null) {
            throw new IllegalArgumentException(
                    "Continuation action is required."
            );
        }

        FlywheelResidualContinuationAction expected =
                expectedAction(
                        sourceAction
                );

        if (continuationAction != expected) {
            throw new IllegalArgumentException(
                    "Continuation action is incompatible with source remediation authority."
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
                    "Continuation rationale is required."
            );
        }

        if (rationale.length() > 2500) {
            throw new IllegalArgumentException(
                    "Continuation rationale cannot exceed 2500 characters."
            );
        }
    }

    public FlywheelResidualContinuationAction expectedAction(
            FlywheelResidualRemediationAction sourceAction
    ) {
        if (sourceAction == null) {
            throw new IllegalArgumentException(
                    "Source remediation action is required."
            );
        }

        return switch (sourceAction) {
            case RECOVERY_FOLLOW_UP ->
                    FlywheelResidualContinuationAction.RECOVERY_RETRY;

            case WRITE_OFF_REVIEW ->
                    FlywheelResidualContinuationAction.WRITE_OFF_ESCALATION;

            case INVESTIGATION_ESCALATION ->
                    FlywheelResidualContinuationAction.INVESTIGATION_ESCALATION;

            case RESIDUAL_ACCEPTANCE_REVIEW ->
                    FlywheelResidualContinuationAction.RISK_ACCEPTANCE_ESCALATION;
        };
    }

    private BigDecimal money(
            BigDecimal value
    ) {
        if (value == null) {
            throw new IllegalArgumentException(
                    "Remaining residual is required."
            );
        }

        try {
            return value.setScale(
                    2,
                    RoundingMode.UNNECESSARY
            );

        } catch (ArithmeticException exception) {
            throw new IllegalArgumentException(
                    "Remaining residual must use exact cents.",
                    exception
            );
        }
    }
}
