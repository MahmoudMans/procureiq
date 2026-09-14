package com.procureiq.planning;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record PlanRequestLinkInput(
        @NotNull
        UUID purchaseRequestId
) {
}
