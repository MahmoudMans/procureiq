package com.procureiq.strategicokr;

public record OkrOperatingScopeOptionResponse(
        OkrSourceScopeType scopeType,
        String scopeKey,
        String scopeLabel
) {
}
