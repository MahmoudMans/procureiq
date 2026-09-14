package com.procureiq.budget;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record BudgetUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
