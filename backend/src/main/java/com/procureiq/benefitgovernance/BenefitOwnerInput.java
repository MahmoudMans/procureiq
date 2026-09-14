package com.procureiq.benefitgovernance;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record BenefitOwnerInput(

        @NotNull
        UUID ownerUserId
) {
}
