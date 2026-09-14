package com.procureiq.planning;

import java.util.List;

public record PlanningContextOptionsResponse(
        List<PlanningDepartmentOptionResponse> departments,
        List<PlanningUserOptionResponse> users,
        List<PlanningRequestOptionResponse> purchaseRequests,
        List<String> categories
) {
}
