package com.procureiq.benefitgovernance;

import java.util.List;

public record BenefitsGovernanceContextResponse(
        List<ApprovedScenarioOptionResponse> approvedScenarios,
        List<BenefitUserOptionResponse> users
) {
}
