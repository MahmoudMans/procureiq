package com.procureiq.contract;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

@Component
public class ContractComplianceCalculator {

    private static final long EXPIRING_SOON_DAYS =
            30;

    public ComplianceDocumentStatus documentStatus(
            LocalDate expiryDate,
            LocalDate today
    ) {
        if (expiryDate == null) {
            return ComplianceDocumentStatus.NO_EXPIRY;
        }

        if (expiryDate.isBefore(today)) {
            return ComplianceDocumentStatus.EXPIRED;
        }

        long days =
                ChronoUnit.DAYS.between(
                        today,
                        expiryDate
                );

        if (days <= EXPIRING_SOON_DAYS) {
            return ComplianceDocumentStatus.EXPIRING_SOON;
        }

        return ComplianceDocumentStatus.VALID;
    }

    public long daysUntil(
            LocalDate date,
            LocalDate today
    ) {
        if (date == null) {
            return Long.MAX_VALUE;
        }

        return ChronoUnit.DAYS.between(
                today,
                date
        );
    }

    public BigDecimal complianceScore(
            long requiredDocuments,
            long validRequiredDocuments
    ) {
        if (requiredDocuments == 0) {
            return new BigDecimal(
                    "100.00"
            );
        }

        return BigDecimal.valueOf(
                        validRequiredDocuments
                )
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        BigDecimal.valueOf(
                                requiredDocuments
                        ),
                        2,
                        RoundingMode.HALF_UP
                );
    }
}
