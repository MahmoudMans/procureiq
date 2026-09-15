package com.procureiq.strategyroadmap;

import java.time.LocalDate;
import java.util.UUID;

public record RoadmapGateResponse(
        UUID id,
        UUID initiativeId,
        String gateName,
        LocalDate dueDate,
        RoadmapGateStatus status,
        boolean overdue,
        String decisionNote,
        String decidedByName
) {
}
