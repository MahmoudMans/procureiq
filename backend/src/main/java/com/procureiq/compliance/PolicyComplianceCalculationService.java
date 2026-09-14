package com.procureiq.compliance;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class PolicyComplianceCalculationService {

    public BigDecimal resolutionRate(
            long totalViolations,
            long openViolations,
            long pendingWaivers
    ) {
        if (
                totalViolations <= 0
        ) {
            return new BigDecimal(
                    "100.00"
            );
        }

        long unresolved =
                Math.max(
                        0,
                        openViolations
                                +
                                pendingWaivers
                );

        long resolved =
                Math.max(
                        0,
                        totalViolations
                                -
                                unresolved
                );

        return BigDecimal
                .valueOf(
                        resolved
                )
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        BigDecimal.valueOf(
                                totalViolations
                        ),
                        2,
                        RoundingMode.HALF_UP
                );
    }
}
