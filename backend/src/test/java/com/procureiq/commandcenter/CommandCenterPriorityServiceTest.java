package com.procureiq.commandcenter;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertTrue;

class CommandCenterPriorityServiceTest {

    private CommandCenterPriorityService service;

    private LocalDate today;

    @BeforeEach
    void setUp() {
        service =
                new CommandCenterPriorityService();

        today =
                LocalDate.of(
                        2026,
                        9,
                        14
                );
    }

    @Test
    void criticalShouldRankAboveHigh() {
        int critical =
                service.priorityScore(
                        CommandCenterSeverity.CRITICAL,
                        null,
                        today
                );

        int high =
                service.priorityScore(
                        CommandCenterSeverity.HIGH,
                        null,
                        today
                );

        assertTrue(
                critical > high
        );
    }

    @Test
    void overdueShouldIncreasePriority() {
        int normal =
                service.priorityScore(
                        CommandCenterSeverity.HIGH,
                        today.plusDays(20),
                        today
                );

        int overdue =
                service.priorityScore(
                        CommandCenterSeverity.HIGH,
                        today.minusDays(10),
                        today
                );

        assertTrue(
                overdue > normal
        );
    }

    @Test
    void nearDeadlineShouldRankAboveDistantDeadline() {
        int near =
                service.priorityScore(
                        CommandCenterSeverity.MEDIUM,
                        today.plusDays(1),
                        today
                );

        int distant =
                service.priorityScore(
                        CommandCenterSeverity.MEDIUM,
                        today.plusDays(60),
                        today
                );

        assertTrue(
                near > distant
        );
    }
}
