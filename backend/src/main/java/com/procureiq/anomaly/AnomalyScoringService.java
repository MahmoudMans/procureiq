package com.procureiq.anomaly;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class AnomalyScoringService {

    public BigDecimal score(
            AnomalySeverity severity,
            BigDecimal ruleWeight,
            BigDecimal metricValue,
            BigDecimal exposureValue
    ) {
        BigDecimal score =
                switch (
                        severity
                ) {
                    case LOW ->
                            new BigDecimal(
                                    "20.00"
                            );

                    case MEDIUM ->
                            new BigDecimal(
                                    "40.00"
                            );

                    case HIGH ->
                            new BigDecimal(
                                    "65.00"
                            );

                    case CRITICAL ->
                            new BigDecimal(
                                    "85.00"
                            );
                };

        if (ruleWeight != null) {
            score =
                    score.add(
                            ruleWeight
                                    .min(
                                            new BigDecimal(
                                                    "10.00"
                                            )
                                    )
                    );
        }

        if (
                metricValue != null
                &&
                metricValue.compareTo(
                        new BigDecimal(
                                "3.00"
                        )
                ) >= 0
        ) {
            score =
                    score.add(
                            new BigDecimal(
                                    "3.00"
                            )
                    );
        }

        if (
                exposureValue != null
                &&
                exposureValue.compareTo(
                        new BigDecimal(
                                "100000.00"
                        )
                ) >= 0
        ) {
            score =
                    score.add(
                            new BigDecimal(
                                    "5.00"
                            )
                    );
        } else if (
                exposureValue != null
                &&
                exposureValue.compareTo(
                        new BigDecimal(
                                "10000.00"
                        )
                ) >= 0
        ) {
            score =
                    score.add(
                            new BigDecimal(
                                    "2.00"
                            )
                    );
        }

        return score
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
}
