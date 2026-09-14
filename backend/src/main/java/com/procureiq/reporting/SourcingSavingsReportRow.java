package com.procureiq.reporting;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SourcingSavingsReportRow(
        String rfqNumber,
        String supplierName,
        BigDecimal selectedTotal,
        BigDecimal highestSubmittedTotal,
        BigDecimal savings,
        LocalDate awardDate
) {
}
