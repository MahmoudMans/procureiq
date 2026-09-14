package com.procureiq.strategicokr;

import java.util.List;

public record OkrContextResponse(
        List<OkrUserOptionResponse> users,
        List<OkrOperatingScopeOptionResponse> operatingScopes,
        List<OkrImprovementOptionResponse> improvementInitiatives
) {
}
