package com.procureiq.interventionexecution;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record InterventionExecutionEvidenceResponse(
        UUID id,
        UUID executionCaseId,
        LocalDate implementedOn,
        BigDecimal implementedCapitalAmount,
        String evidenceNote,
        String referenceText,
        String recordedByName,
        Instant recordedAt
) {
}
