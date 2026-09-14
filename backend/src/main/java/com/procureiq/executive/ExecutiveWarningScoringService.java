package com.procureiq.executive;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class ExecutiveWarningScoringService {

    public BigDecimal priorityScore(
            ExecutiveWarningSeverity severity,
            BigDecimal metricValue,
            BigDecimal exposureValue
    ) {
        BigDecimal score =
                switch (
                        severity
                ) {
                    case INFO ->
                            new BigDecimal(
                                    "10.00"
                            );

                    case LOW ->
                            new BigDecimal(
                                    "25.00"
                            );

                    case MEDIUM ->
                            new BigDecimal(
                                    "45.00"
                            );

                    case HIGH ->
                            new BigDecimal(
                                    "70.00"
                            );

                    case CRITICAL ->
                            new BigDecimal(
                                    "90.00"
                            );
                };

        if (
                metricValue != null
                &&
                metricValue.compareTo(
                        new BigDecimal(
                                "2.00"
                        )
                ) >= 0
        ) {
            score =
                    score.add(
                            new BigDecimal(
                                    "5.00"
                            )
                    );
        }

        if (
                exposureValue != null
                &&
                exposureValue.compareTo(
                        BigDecimal.ZERO
                ) > 0
        ) {
            if (
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
                    exposureValue.compareTo(
                            new BigDecimal(
                                    "10000.00"
                            )
                    ) >= 0
            ) {
                score =
                        score.add(
                                new BigDecimal(
                                        "3.00"
                                )
                        );
            } else {
                score =
                        score.add(
                                BigDecimal.ONE
                        );
            }
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
