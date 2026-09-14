package com.procureiq.risk;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class RiskScoringServiceTest {

    private RiskScoringService
            scoringService;

    @BeforeEach
    void setUp() {
        scoringService =
                new RiskScoringService();
    }

    @Test
    void shouldCalculateRiskScore() {
        assertEquals(
                20,
                scoringService.score(
                        4,
                        5
                )
        );

        assertEquals(
                6,
                scoringService.score(
                        2,
                        3
                )
        );
    }

    @Test
    void shouldMapSeverityBands() {
        assertEquals(
                RiskSeverity.LOW,
                scoringService.severity(
                        4
                )
        );

        assertEquals(
                RiskSeverity.MEDIUM,
                scoringService.severity(
                        9
                )
        );

        assertEquals(
                RiskSeverity.HIGH,
                scoringService.severity(
                        15
                )
        );

        assertEquals(
                RiskSeverity.CRITICAL,
                scoringService.severity(
                        16
                )
        );

        assertEquals(
                RiskSeverity.CRITICAL,
                scoringService.severity(
                        25
                )
        );
    }

    @Test
    void shouldRejectInvalidScale() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        scoringService.score(
                                0,
                                5
                        )
        );

        assertThrows(
                IllegalArgumentException.class,
                () ->
                        scoringService.score(
                                5,
                                6
                        )
        );
    }
}
