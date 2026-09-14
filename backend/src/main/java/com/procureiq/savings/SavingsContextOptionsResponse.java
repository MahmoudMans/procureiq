package com.procureiq.savings;

import java.util.List;

public record SavingsContextOptionsResponse(
        List<SavingsUserOptionResponse> users,
        List<SavingsSupplierOptionResponse> suppliers,
        List<SavingsRfqOptionResponse> rfqs,
        List<SavingsPurchaseOrderOptionResponse> purchaseOrders,
        List<String> categories
) {
}
