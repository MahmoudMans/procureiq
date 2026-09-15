package com.procureiq.capitalredeployment;

import java.util.List;

public record CapitalRedeploymentCaseDetailResponse(
        CapitalRedeploymentCaseResponse redeploymentCase,
        List<CapitalRedeploymentUserOptionResponse> users,
        List<CapitalRedeploymentGateResponse> gates,
        List<CapitalRedeploymentAuthorizationResponse> authorizations,
        List<CapitalRedeploymentReleaseResponse> releases,
        List<CapitalRedeploymentVerificationResponse> verifications
) {
}
