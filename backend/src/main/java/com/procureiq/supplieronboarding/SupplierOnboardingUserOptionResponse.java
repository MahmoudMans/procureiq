package com.procureiq.supplieronboarding;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record SupplierOnboardingUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
