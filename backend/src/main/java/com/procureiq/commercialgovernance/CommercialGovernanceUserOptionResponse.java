package com.procureiq.commercialgovernance;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record CommercialGovernanceUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
