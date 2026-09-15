package com.procureiq.strategicalignment;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StrategicAlignmentScoringServiceTest {

    private StrategicAlignmentScoringService service;

    @BeforeEach
    void setUp() {
        service =
                new StrategicAlignmentScoringService();
    }

    @Test
    void shouldClassifyAllocationStatuses() {
        assertEquals(
                AlignmentStatus.UNALIGNED,
                service.status(
                        BigDecimal.ZERO
                )
        );

        assertEquals(
                AlignmentStatus.PARTIAL,
                service.status(
                        new BigDecimal(
                                "50.00"
                        )
                )
        );

        assertEquals(
                AlignmentStatus.FULL,
                service.status(
                        new BigDecimal(
                                "100.00"
                        )
                )
        );

        assertEquals(
                AlignmentStatus.CONFLICT,
                service.status(
                        new BigDecimal(
                                "120.00"
                        )
                )
        );
    }

    @Test
    void shouldProduceStrongScoreForWellAlignedPortfolio() {
        AlignmentScoreResult result =
                service.score(
                        List.of(
                                metric(
                                        100000,
                                        50000,
                                        100,
                                        1,
                                        0
                                ),
                                metric(
                                        50000,
                                        20000,
                                        100,
                                        1,
                                        0
                                )
                        ),
                        2,
                        2
                );

        assertEquals(
                AlignmentHealth.EXCELLENT,
                result.health()
        );

        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                result.alignmentScore()
        );
    }

    @Test
    void shouldExposeStrategicGapWhenMostWorkIsUnaligned() {
        AlignmentScoreResult result =
                service.score(
                        List.of(
                                metric(
                                        100000,
                                        50000,
                                        0,
                                        0,
                                        0
                                ),
                                metric(
                                        100000,
                                        50000,
                                        0,
                                        0,
                                        0
                                ),
                                metric(
                                        100000,
                                        50000,
                                        50,
                                        1,
                                        1
                                )
                        ),
                        3,
                        1
                );

        assertTrue(
                result.alignmentScore()
                        .compareTo(
                                new BigDecimal(
                                        "50.00"
                                )
                        ) < 0
        );

        assertEquals(
                AlignmentHealth.CRITICAL,
                result.health()
        );
    }

    private AlignmentItemMetric metric(
            long value,
            long risk,
            long allocation,
            int objectives,
            int conflicts
    ) {
        return new AlignmentItemMetric(
                BigDecimal.valueOf(
                        value
                ),
                BigDecimal.valueOf(
                        risk
                ),
                BigDecimal.valueOf(
                        allocation
                ),
                objectives,
                conflicts
        );
    }
}
