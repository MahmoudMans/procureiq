package com.procureiq.suppliercollaboration;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public record CollaborationActionInput(

        @NotNull
        CollaborationActionType actionType,

        @NotNull
        CollaborationActionAudience audience,

        @NotBlank
        @Size(max = 240)
        String title,

        @Size(max = 2500)
        String description,

        UUID assigneeUserId,

        @Size(max = 220)
        String externalAssigneeLabel,

        @NotNull
        Instant dueAt
) {
}
