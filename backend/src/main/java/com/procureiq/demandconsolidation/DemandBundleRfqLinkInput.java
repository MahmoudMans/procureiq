package com.procureiq.demandconsolidation;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record DemandBundleRfqLinkInput(

        @NotNull
        UUID rfqId
) {
}
