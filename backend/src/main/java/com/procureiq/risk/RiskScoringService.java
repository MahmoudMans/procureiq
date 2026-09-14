package com.procureiq.risk;

import org.springframework.stereotype.Component;

@Component
public class RiskScoringService {

    public int score(
            int likelihood,
            int impact
    ) {
        validateScale(
                likelihood,
                "likelihood"
        );

        validateScale(
                impact,
                "impact"
        );

        return likelihood
                * impact;
    }

    public RiskSeverity severity(
            int score
    ) {
        if (
                score < 1
                ||
                score > 25
        ) {
            throw new IllegalArgumentException(
                    "Risk score must be between 1 and 25."
            );
        }

        if (score <= 4) {
            return RiskSeverity.LOW;
        }

        if (score <= 9) {
            return RiskSeverity.MEDIUM;
        }

        if (score <= 15) {
            return RiskSeverity.HIGH;
        }

        return RiskSeverity.CRITICAL;
    }

    private void validateScale(
            int value,
            String field
    ) {
        if (
                value < 1
                ||
                value > 5
        ) {
            throw new IllegalArgumentException(
                    "Risk "
                            + field
                            + " must be between 1 and 5."
            );
        }
    }
}
