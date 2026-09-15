package com.procureiq.capabilityplanning;

import java.math.BigDecimal;

public record CapabilityRequirementFit(
        int requiredProficiency,
        int availableProficiency,
        BigDecimal weightPct
) {
}
