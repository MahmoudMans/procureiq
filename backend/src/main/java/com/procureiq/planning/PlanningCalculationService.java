package com.procureiq.planning;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class PlanningCalculationService {

    public BigDecimal variance(
            BigDecimal planned,
            BigDecimal actual
    ) {
        return actual
                .subtract(planned)
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal conversionRate(
            long converted,
            long total
    ) {
        if (total == 0) {
            return BigDecimal.ZERO
                    .setScale(2);
        }

        return BigDecimal.valueOf(
                        converted
                )
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        BigDecimal.valueOf(
                                total
                        ),
                        2,
                        RoundingMode.HALF_UP
                );
    }
}
