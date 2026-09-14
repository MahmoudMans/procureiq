package com.procureiq.supplierinsight;

import com.procureiq.supplier.SupplierRiskLevel;
import com.procureiq.supplier.SupplierStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record Supplier360Response(
        UUID supplierId,
        String supplierCode,
        String legalName,
        String category,
        String country,
        SupplierStatus status,
        SupplierRiskLevel riskLevel,
        BigDecimal rating,

        BigDecimal committedSpend,
        long purchaseOrderCount,
        long openPurchaseOrderCount,
        long overduePurchaseOrderCount,

        long invitedRfqCount,
        long submittedQuotationCount,
        long awardCount,
        BigDecimal sourcingWinRate,
        BigDecimal averageAwardValue,

        long trackedDeliveryOrders,
        long completedDeliveryOrders,
        long onTimeOrders,
        long lateOrders,
        BigDecimal onTimeDeliveryRate,
        BigDecimal fulfillmentRate,
        LocalDate lastReceiptDate,

        List<Supplier360MonthlySpendResponse> monthlySpend,
        List<Supplier360CategorySpendResponse> categorySpend,
        List<Supplier360PurchaseOrderResponse> recentPurchaseOrders,
        List<Supplier360SourcingResponse> recentSourcing,
        List<Supplier360AwardResponse> recentAwards,
        List<Supplier360ActivityResponse> recentActivity
) {
}
