package com.procureiq.reporting;

import java.time.LocalDate;
import java.util.List;

public record ExecutiveReportResponse(
        LocalDate periodStart,
        LocalDate periodEnd,
        ReportSummaryResponse summary,
        List<ReportBreakdownResponse> spendBySupplier,
        List<ReportBreakdownResponse> spendByCategory,
        List<SourcingSavingsReportRow> sourcingSavings,
        List<PurchaseOrderReportRow> purchaseOrders,
        List<DeliveryReportRow> deliveries
) {
}
