package com.procureiq.flywheelcontinuationoutcome;

import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationAction;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

@Service
public class FlywheelContinuationOutcomePolicyService {

    public BigDecimal validateAndRemaining(
            FlywheelResidualContinuationAction sourceAction,
            BigDecimal sourceResidualAmount,
            FlywheelContinuationOutcomeResolutionType resolutionType,
            BigDecimal observedReductionAmount,
            LocalDate observedOn,
            String evidenceReference,
            String evidenceNote,
            LocalDate today
    ) {
        if (sourceAction == null) {
            throw new IllegalArgumentException(
                    "Source continuation action is required."
            );
        }

        if (resolutionType == null) {
            throw new IllegalArgumentException(
                    "Outcome resolution type is required."
            );
        }

        BigDecimal source =
                money(
                        sourceResidualAmount,
                        "Source residual amount"
                );

        BigDecimal reduction =
                money(
                        observedReductionAmount,
                        "Observed reduction amount"
                );

        if (source.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Source residual amount must be positive."
            );
        }

        if (reduction.signum() < 0) {
            throw new IllegalArgumentException(
                    "Observed reduction amount cannot be negative."
            );
        }

        if (
                reduction.compareTo(
                        source
                )
                > 0
        ) {
            throw new IllegalArgumentException(
                    "Observed reduction cannot exceed source residual."
            );
        }

        validateCompatibility(
                sourceAction,
                resolutionType
        );

        if (
                (
                        resolutionType
                        ==
                        FlywheelContinuationOutcomeResolutionType.RECOVERY_CONFIRMED

                        ||

                        resolutionType
                        ==
                        FlywheelContinuationOutcomeResolutionType.WRITE_OFF_CONFIRMED
                )

                &&

                reduction.signum() <= 0
        ) {
            throw new IllegalArgumentException(
                    "Confirmed financial reduction requires a positive observed reduction."
            );
        }

        if (
                resolutionType
                ==
                FlywheelContinuationOutcomeResolutionType.PARTIAL

                &&

                (
                        reduction.signum() <= 0

                        ||

                        reduction.compareTo(
                                source
                        )
                        >= 0
                )
        ) {
            throw new IllegalArgumentException(
                    "PARTIAL outcome requires a positive incomplete reduction."
            );
        }

        if (
                resolutionType
                ==
                FlywheelContinuationOutcomeResolutionType.UNRESOLVED

                &&

                reduction.signum() != 0
        ) {
            throw new IllegalArgumentException(
                    "UNRESOLVED outcome cannot claim residual reduction."
            );
        }

        if (
                resolutionType
                ==
                FlywheelContinuationOutcomeResolutionType.RISK_ACCEPTANCE_CONFIRMED

                &&

                reduction.signum() != 0
        ) {
            throw new IllegalArgumentException(
                    "Risk acceptance does not reduce financial residual."
            );
        }

        if (observedOn == null) {
            throw new IllegalArgumentException(
                    "Observed date is required."
            );
        }

        if (today == null) {
            throw new IllegalArgumentException(
                    "Current date is required."
            );
        }

        if (
                observedOn.isAfter(
                        today
                )
        ) {
            throw new IllegalArgumentException(
                    "Observed date cannot be in the future."
            );
        }

        if (
                evidenceReference == null
                ||
                evidenceReference.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Evidence reference is required."
            );
        }

        if (
                evidenceNote == null
                ||
                evidenceNote.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Evidence note is required."
            );
        }

        return source.subtract(
                reduction
        );
    }

    public FlywheelContinuationOutcomeResidualDisposition disposition(
            BigDecimal remainingResidual
    ) {
        BigDecimal remaining =
                money(
                        remainingResidual,
                        "Remaining residual amount"
                );

        if (remaining.signum() < 0) {
            throw new IllegalArgumentException(
                    "Remaining residual cannot be negative."
            );
        }

        if (remaining.signum() == 0) {
            return FlywheelContinuationOutcomeResidualDisposition.FULLY_RESOLVED;
        }

        return FlywheelContinuationOutcomeResidualDisposition.FURTHER_GOVERNANCE_REQUIRED;
    }

    private void validateCompatibility(
            FlywheelResidualContinuationAction sourceAction,
            FlywheelContinuationOutcomeResolutionType resolutionType
    ) {
        boolean compatible =
                switch (sourceAction) {
                    case RECOVERY_RETRY ->
                            resolutionType
                            ==
                            FlywheelContinuationOutcomeResolutionType.RECOVERY_CONFIRMED

                            ||

                            resolutionType
                            ==
                            FlywheelContinuationOutcomeResolutionType.PARTIAL

                            ||

                            resolutionType
                            ==
                            FlywheelContinuationOutcomeResolutionType.UNRESOLVED;

                    case WRITE_OFF_ESCALATION ->
                            resolutionType
                            ==
                            FlywheelContinuationOutcomeResolutionType.WRITE_OFF_CONFIRMED

                            ||

                            resolutionType
                            ==
                            FlywheelContinuationOutcomeResolutionType.PARTIAL

                            ||

                            resolutionType
                            ==
                            FlywheelContinuationOutcomeResolutionType.UNRESOLVED;

                    case INVESTIGATION_ESCALATION ->
                            resolutionType
                            ==
                            FlywheelContinuationOutcomeResolutionType.INVESTIGATION_CONCLUDED

                            ||

                            resolutionType
                            ==
                            FlywheelContinuationOutcomeResolutionType.PARTIAL

                            ||

                            resolutionType
                            ==
                            FlywheelContinuationOutcomeResolutionType.UNRESOLVED;

                    case RISK_ACCEPTANCE_ESCALATION ->
                            resolutionType
                            ==
                            FlywheelContinuationOutcomeResolutionType.RISK_ACCEPTANCE_CONFIRMED

                            ||

                            resolutionType
                            ==
                            FlywheelContinuationOutcomeResolutionType.UNRESOLVED;
                };

        if (!compatible) {
            throw new IllegalArgumentException(
                    "Outcome resolution is incompatible with continuation action."
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
