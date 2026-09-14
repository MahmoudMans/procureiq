package com.procureiq.compliance;

import java.util.List;

public record PolicyComplianceContextResponse(
        List<ComplianceUserOptionResponse> users
) {
}
