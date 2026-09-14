package com.procureiq.savings;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record SavingsUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
