package com.procureiq.delivery;

public record DeliverySummaryResponse(
        long totalReceipts,
        long openOrders,
        long partiallyReceivedOrders,
        long completedOrders,
        long overdueOrders
) {
}
