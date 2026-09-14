package com.procureiq.risk;

import java.util.List;

public record RiskContextOptionsResponse(
        List<RiskUserOptionResponse> users,
        List<RiskSupplierOptionResponse> suppliers,
        List<RiskContractOptionResponse> contracts,
        List<RiskPurchaseOrderOptionResponse> purchaseOrders,
        List<RiskRfqOptionResponse> rfqs
) {
}
