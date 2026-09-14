package com.procureiq.guidedbuying;

import java.util.List;

public record GuidedBuyingContextResponse(
        List<GuidedBuyingDepartmentOptionResponse> departments,
        List<GuidedBuyingUserOptionResponse> users,
        List<GuidedBuyingTemplateResponse> templates,
        List<PreferredSupplierResponse> preferredSuppliers,
        List<GuidedBuyingRequestOptionResponse> purchaseRequests,
        List<String> categories
) {
}
