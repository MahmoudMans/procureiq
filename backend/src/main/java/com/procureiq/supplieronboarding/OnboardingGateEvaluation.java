package com.procureiq.supplieronboarding;

import java.util.List;

public record OnboardingGateEvaluation(
        boolean activationEligible,
        List<String> reasons
) {
}
