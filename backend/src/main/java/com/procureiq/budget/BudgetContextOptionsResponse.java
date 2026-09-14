package com.procureiq.budget;

import java.util.List;

public record BudgetContextOptionsResponse(
        List<BudgetDepartmentOptionResponse> departments,
        List<BudgetUserOptionResponse> users,
        List<BudgetRequestOptionResponse> purchaseRequests,
        List<String> categories
) {
}
