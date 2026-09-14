package com.procureiq.negotiation;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record NegotiationWorkspaceInput(

        @NotNull
        UUID baselineQuotationId,

        UUID ownerUserId,

        @Size(max = 3000)
        String notes
) {
}
