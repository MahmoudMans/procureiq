package com.procureiq.commandcenter;

import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

@Component
public class CommandCenterPriorityService {

    public int priorityScore(
            CommandCenterSeverity severity,
            LocalDate dueDate,
            LocalDate today
    ) {
        int score =
                switch (severity) {
                    case CRITICAL -> 400;
                    case HIGH -> 300;
                    case MEDIUM -> 200;
                    case INFO -> 100;
                };

        if (
                dueDate == null
                ||
                today == null
        ) {
            return score;
        }

        long days =
                ChronoUnit.DAYS.between(
                        today,
                        dueDate
                );

        if (days < 0) {
            long overdueDays =
                    Math.abs(days);

            score +=
                    60
                    +
                    (int) Math.min(
                            100,
                            overdueDays * 4
                    );

            return score;
        }

        if (days <= 1) {
            return score + 55;
        }

        if (days <= 3) {
            return score + 40;
        }

        if (days <= 7) {
            return score + 25;
        }

        if (days <= 30) {
            return score + 10;
        }

        return score;
    }
}
