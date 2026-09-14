package com.procureiq.commercialgovernance;

import java.util.List;

public record CommercialGovernanceContextResponse(
        List<ContractGovernanceOptionResponse> contracts,
        List<CommercialGovernanceUserOptionResponse> users
) {
}
