package com.procureiq.suppliercollaboration;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CollaborationWorkspaceInput(

        @NotNull
        UUID supplierId,

        @NotNull
        CollaborationWorkspaceType workspaceType,

        @NotNull
        CollaborationPriority priority,

        @NotBlank
        @Size(max = 240)
        String title,

        UUID purchaseOrderId,

        UUID rfqId,

        @Size(max = 300)
        String externalReference,

        UUID ownerUserId,

        @Min(1)
        @Max(720)
        Integer supplierResponseSlaHours,

        @Size(max = 3000)
        String notes
) {
}
