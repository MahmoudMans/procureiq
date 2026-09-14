package com.procureiq.supplierperformance;

import java.util.List;

public record SupplierPerformanceContextResponse(
        List<PerformanceSupplierOptionResponse> suppliers,
        List<PerformanceUserOptionResponse> users
) {
}
