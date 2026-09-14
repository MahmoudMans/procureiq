package com.procureiq.supplierdocument;

import java.util.UUID;

public record SupplierDocumentRequirementResponse(
        UUID id,
        String requirementCode,
        String name,
        String description,
        SupplierDocumentType documentType,
        String categoryScope,
        boolean mandatory,
        boolean expiryRequired,
        int renewalLeadDays,
        boolean onboardingRelevant,
        boolean sustainabilityRelevant,
        boolean active
) {
}
