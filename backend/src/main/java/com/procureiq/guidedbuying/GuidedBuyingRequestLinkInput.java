package com.procureiq.guidedbuying;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record GuidedBuyingRequestLinkInput(

        @NotNull
        UUID purchaseRequestId
) {
}
