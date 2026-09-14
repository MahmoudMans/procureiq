package com.procureiq.negotiation;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record NegotiationUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
