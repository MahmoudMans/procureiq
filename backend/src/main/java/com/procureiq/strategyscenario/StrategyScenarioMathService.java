package com.procureiq.strategyscenario;

import com.procureiq.strategycockpit.BoardDimensionKey;
import com.procureiq.strategycockpit.BoardHealth;
import com.procureiq.strategycockpit.BoardMovement;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class StrategyScenarioMathService {

    public BigDecimal weight(
            BoardDimensionKey key
    ) {
        return switch (
                key
        ) {
            case OBJECTIVE_EXECUTION ->
                    new BigDecimal(
                            "25.00"
                    );

            case STRATEGIC_ALIGNMENT ->
                    new BigDecimal(
                            "20.00"
                    );

            case CAPACITY_READINESS ->
                    new BigDecimal(
                            "20.00"
                    );

            case CAPABILITY_READINESS ->
                    new BigDecimal(
                            "20.00"
                    );

            case SUCCESSION_RESILIENCE ->
                    new BigDecimal(
                            "15.00"
                    );
        };
    }

    public BigDecimal applyAdjustment(
            BigDecimal baseline,
            BigDecimal adjustmentPoints
    ) {
        return decimal(
                baseline
        )
                .add(
                        decimal(
                                adjustmentPoints
                        )
                )
                .max(
                        BigDecimal.ZERO
                )
                .min(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public ScenarioDimensionResult dimension(
            BoardDimensionKey key,
            BigDecimal baselineScore,
            BigDecimal adjustmentPoints
    ) {
        BigDecimal simulated =
                applyAdjustment(
                        baselineScore,
                        adjustmentPoints
                );

        BigDecimal weight =
                weight(
                        key
                );

        return new ScenarioDimensionResult(
                key,
                weight,
                bounded(
                        baselineScore
                ),
                decimal(
                        adjustmentPoints
                ),
                simulated,
                simulated
                        .multiply(
                                weight
                        )
                        .divide(
                                new BigDecimal(
                                        "100.00"
                                ),
                                2,
                                RoundingMode.HALF_UP
                        ),
                health(
                        simulated
                )
        );
    }

    public BigDecimal overallScore(
            List<ScenarioDimensionResult> dimensions
    ) {
        if (dimensions.isEmpty()) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        BigDecimal totalWeight =
                dimensions.stream()
                        .map(
                                ScenarioDimensionResult::
                                        weightPct
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        if (
                totalWeight.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        return dimensions.stream()
                .map(
                        ScenarioDimensionResult::
                                weightedContribution
                )
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                )
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        totalWeight,
                        2,
                        RoundingMode.HALF_UP
                )
                .max(
                        BigDecimal.ZERO
                )
                .min(
                        new BigDecimal(
                                "100.00"
                        )
                );
    }

    public BoardHealth health(
            BigDecimal score
    ) {
        BigDecimal normalized =
                bounded(
                        score
                );

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "85.00"
                        )
                ) >= 0
        ) {
            return BoardHealth.EXCELLENT;
        }

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "70.00"
                        )
                ) >= 0
        ) {
            return BoardHealth.STRONG;
        }

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            return BoardHealth.WATCH;
        }

        return BoardHealth.CRITICAL;
    }

    public BoardMovement movement(
            BigDecimal simulatedScore,
            BigDecimal baselineScore
    ) {
        BigDecimal delta =
                delta(
                        simulatedScore,
                        baselineScore
                );

        if (
                delta.compareTo(
                        new BigDecimal(
                                "2.00"
                        )
                ) >= 0
        ) {
            return BoardMovement.IMPROVING;
        }

        if (
                delta.compareTo(
                        new BigDecimal(
                                "-2.00"
                        )
                ) <= 0
        ) {
            return BoardMovement.DETERIORATING;
        }

        return BoardMovement.STABLE;
    }

    public BigDecimal delta(
            BigDecimal simulatedScore,
            BigDecimal baselineScore
    ) {
        return bounded(
                simulatedScore
        )
                .subtract(
                        bounded(
                                baselineScore
                        )
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal bounded(
            BigDecimal value
    ) {
        return decimal(
                value
        )
                .max(
                        BigDecimal.ZERO
                )
                .min(
                        new BigDecimal(
                                "100.00"
                        )
                );
    }

    public BigDecimal decimal(
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
