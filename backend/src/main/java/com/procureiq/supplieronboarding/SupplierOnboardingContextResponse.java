package com.procureiq.supplieronboarding;

import java.util.List;

public record SupplierOnboardingContextResponse(
        List<SupplierOnboardingSupplierOptionResponse> suppliers,
        List<SupplierOnboardingUserOptionResponse> users
) {
}
