package com.procureiq.dataquality;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DataQualityScoringServiceTest {

    private DataQualityScoringService service;

    @BeforeEach
    void setUp() {
        service =
                new DataQualityScoringService();
    }

    @Test
    void shouldReturnPerfectScoreWhenNoRuleIsAffected() {
        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                service.domainScore(
                        new BigDecimal(
                                "40.00"
                        ),
                        BigDecimal.ZERO
                )
        );
    }

    @Test
    void shouldWeightAffectedRules() {
        assertEquals(
                new BigDecimal(
                        "75.00"
                ),
                service.domainScore(
                        new BigDecimal(
                                "40.00"
                        ),
                        new BigDecimal(
                                "10.00"
                        )
                )
        );
    }

    @Test
    void shouldAverageDomainScores() {
        assertEquals(
                new BigDecimal(
                        "80.00"
                ),
                service.overallScore(
                        List.of(
                                new BigDecimal(
                                        "100.00"
                                ),
                                new BigDecimal(
                                        "80.00"
                                ),
                                new BigDecimal(
                                        "60.00"
                                )
                        )
                )
        );
    }
}
