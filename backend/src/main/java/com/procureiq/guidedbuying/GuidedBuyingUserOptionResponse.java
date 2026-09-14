package com.procureiq.guidedbuying;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record GuidedBuyingUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
