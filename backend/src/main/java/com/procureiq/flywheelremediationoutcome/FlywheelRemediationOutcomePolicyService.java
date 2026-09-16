package com.procureiq.flywheelremediationoutcome;

import com.procureiq.flywheelremediation.FlywheelResidualRemediationAction;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

@Service
public class FlywheelRemediationOutcomePolicyService {

    private static final BigDecimal ZERO =
            new BigDecimal("0.00");

    public void validateOutcome(
            FlywheelResidualRemediationAction sourceAction,
            BigDecimal sourceResidualAmount,
            FlywheelRemediationResolutionType resolutionType,
            BigDecimal resolvedAmount,
            LocalDate observedOn,
            String evidenceReference,
            String evidenceNote,
            LocalDate today
    ) {
        if (sourceAction == null) {
            throw new IllegalArgumentException(
                    "Source remediation action is required."
            );
        }

        BigDecimal source =
                money(
                        sourceResidualAmount,
                        "Source residual amount"
                );

        BigDecimal resolved =
                money(
                        resolvedAmount,
                        "Resolved amount"
                );

        if (source.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Source residual amount must be positive."
            );
        }

        if (
                resolved.signum() < 0
                ||
                resolved.compareTo(
                        source
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Resolved amount must be between zero and source residual."
            );
        }

        if (resolutionType == null) {
            throw new IllegalArgumentException(
                    "Resolution type is required."
            );
        }

        validateCompatibility(
                sourceAction,
                resolutionType
        );

        if (
                resolutionType
                ==
                FlywheelRemediationResolutionType.UNRESOLVED
        ) {
            if (resolved.signum() != 0) {
                throw new IllegalArgumentException(
                        "UNRESOLVED outcome must have zero resolved amount."
                );
            }

        } else if (resolved.signum() <= 0) {
            throw new IllegalArgumentException(
                    "An evidenced resolution requires a positive resolved amount."
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

        if (observedOn.isAfter(today)) {
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

        if (evidenceReference.length() > 500) {
            throw new IllegalArgumentException(
                    "Evidence reference cannot exceed 500 characters."
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

        if (evidenceNote.length() > 2500) {
            throw new IllegalArgumentException(
                    "Evidence note cannot exceed 2500 characters."
            );
        }
    }

    public FlywheelRemediationOutcomeMetricResult metrics(
            List<FlywheelRemediationOutcomeMetricInput> items
    ) {
        if (items == null) {
            throw new IllegalArgumentException(
                    "Outcome metric items are required."
            );
        }

        BigDecimal source = ZERO;
        BigDecimal resolved = ZERO;

        int unresolved = 0;

        for (
                FlywheelRemediationOutcomeMetricInput item
                : items
        ) {
            if (item == null) {
                throw new IllegalArgumentException(
                        "Outcome metric item cannot be null."
                );
            }

            BigDecimal itemSource =
                    money(
                            item.sourceResidualAmount(),
                            "Source residual amount"
                    );

            BigDecimal itemResolved =
                    money(
                            item.resolvedAmount(),
                            "Resolved amount"
                    );

            if (itemSource.signum() <= 0) {
                throw new IllegalArgumentException(
                        "Source residual amount must be positive."
                );
            }

            if (
                    itemResolved.signum() < 0
                    ||
                    itemResolved.compareTo(
                            itemSource
                    ) > 0
            ) {
                throw new IllegalArgumentException(
                        "Resolved amount must be within source residual."
                );
            }

            source =
                    source.add(
                            itemSource
                    );

            resolved =
                    resolved.add(
                            itemResolved
                    );

            if (
                    itemSource
                            .subtract(
                                    itemResolved
                            )
                            .signum()
                    > 0
            ) {
                unresolved++;
            }
        }

        return new FlywheelRemediationOutcomeMetricResult(
                source,
                resolved,
                source.subtract(
                        resolved
                ),
                items.size(),
                unresolved
        );
    }

    private void validateCompatibility(
            FlywheelResidualRemediationAction sourceAction,
            FlywheelRemediationResolutionType resolutionType
    ) {
        if (
                resolutionType
                ==
                FlywheelRemediationResolutionType.UNRESOLVED
        ) {
            return;
        }

        boolean compatible =
                switch (
                        sourceAction
                ) {
                    case RECOVERY_FOLLOW_UP ->
                            resolutionType
                            ==
                            FlywheelRemediationResolutionType.RECOVERY_EVIDENCED;

                    case WRITE_OFF_REVIEW ->
                            resolutionType
                            ==
                            FlywheelRemediationResolutionType.WRITE_OFF_EVIDENCED;

                    case INVESTIGATION_ESCALATION ->
                            resolutionType
                            ==
                            FlywheelRemediationResolutionType.INVESTIGATION_RESOLVED;

                    case RESIDUAL_ACCEPTANCE_REVIEW ->
                            resolutionType
                            ==
                            FlywheelRemediationResolutionType.RISK_ACCEPTANCE_EVIDENCED;
                };

        if (!compatible) {
            throw new IllegalArgumentException(
                    "Resolution type is incompatible with the source remediation action."
            );
        }
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
