package com.procureiq.anomaly;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;

public record InvestigationCreateInput(

        UUID ownerUserId,

        @NotNull
        InvestigationPriority priority,

        @NotNull
        LocalDate dueDate
) {
}
