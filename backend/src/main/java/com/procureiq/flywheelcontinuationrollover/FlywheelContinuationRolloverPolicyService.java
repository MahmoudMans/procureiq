package com.procureiq.flywheelcontinuationrollover;

import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationAction;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

@Service
public class FlywheelContinuationRolloverPolicyService {

    public void validateEligibleSource(
            String status,
            String residualDisposition,
            BigDecimal verifiedRemainingResidualAmount,
            int positiveResidualItemCount
    ) {
        if (
                !"VERIFIED".equals(
                        status
                )
        ) {
            throw new IllegalArgumentException(
                    "Residual rollover requires a VERIFIED continuation outcome."
            );
        }

        if (
                !"FURTHER_GOVERNANCE_REQUIRED".equals(
                        residualDisposition
                )
        ) {
            throw new IllegalArgumentException(
                    "Residual rollover requires FURTHER_GOVERNANCE_REQUIRED."
            );
        }

        BigDecimal residual =
                money(
                        verifiedRemainingResidualAmount,
                        "Verified remaining residual"
                );

        if (residual.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Residual rollover requires positive remaining residual."
            );
        }

        if (positiveResidualItemCount <= 0) {
            throw new IllegalArgumentException(
                    "Residual rollover requires at least one positive residual item."
            );
        }
    }

    public FlywheelResidualContinuationAction continuationAction(
            FlywheelResidualContinuationAction sourceAction
    ) {
        if (sourceAction == null) {
            throw new IllegalArgumentException(
                    "Source continuation action is required."
            );
        }

        /*
         * Step 89 intentionally preserves the prior governance action.
         *
         * Changing strategy requires a separate explicit governance decision;
         * rollover itself must not silently transform the action.
         */
        return sourceAction;
    }

    public void validateItem(
            BigDecimal remainingResidual,
            LocalDate targetDate,
            String rationale,
            LocalDate today
    ) {
        BigDecimal residual =
                money(
                        remainingResidual,
                        "Source remaining residual"
                );

        if (residual.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Only positive residual may roll forward."
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

        if (
                targetDate.isBefore(
                        today
                )
        ) {
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
                    "Rollover rationale is required."
            );
        }
    }

    private BigDecimal money(
            BigDecimal value,
            String label
    ) {
        if (value == null) {
            throw new IllegalArgumentException(
                    label
                    + " is required."
            );
        }

        try {
            return value.setScale(
                    2,
                    RoundingMode.UNNECESSARY
            );

        } catch (ArithmeticException exception) {
            throw new IllegalArgumentException(
                    label
                    + " must use exact cents.",
                    exception
            );
        }
    }
}
