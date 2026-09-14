package com.procureiq.benefitgovernance;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record BenefitUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
