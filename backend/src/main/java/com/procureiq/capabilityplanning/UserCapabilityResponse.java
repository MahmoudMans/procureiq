package com.procureiq.capabilityplanning;

import java.time.Instant;
import java.util.UUID;

public record UserCapabilityResponse(
        UUID id,
        UUID userId,
        String userName,
        String role,
        UUID skillId,
        String skillCode,
        String skillName,
        String skillCategory,
        int proficiencyLevel,
        String evidenceNote,
        String assessedByName,
        Instant assessedAt,
        long version
) {
}
