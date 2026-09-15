package com.procureiq.capabilityplanning;

import java.util.UUID;

public record CapabilitySkillResponse(
        UUID id,
        String code,
        String name,
        String category,
        String description,
        boolean active
) {
}
