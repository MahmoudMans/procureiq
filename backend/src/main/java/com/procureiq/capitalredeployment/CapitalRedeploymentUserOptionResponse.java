package com.procureiq.capitalredeployment;

import java.util.UUID;

public record CapitalRedeploymentUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
