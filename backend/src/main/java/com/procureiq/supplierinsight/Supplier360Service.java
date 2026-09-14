package com.procureiq.supplierinsight;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.supplier.SupplierEntity;
import com.procureiq.supplier.SupplierRepository;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class Supplier360Service {

    private static final BigDecimal HUNDRED =
            new BigDecimal("100.00");

    private final Supplier360Repository
            supplier360Repository;

    private final SupplierRepository
            supplierRepository;

    private final AppUserRepository
            appUserRepository;

    public Supplier360Service(
            Supplier360Repository supplier360Repository,
            SupplierRepository supplierRepository,
            AppUserRepository appUserRepository
    ) {
        this.supplier360Repository =
                supplier360Repository;

        this.supplierRepository =
                supplierRepository;

        this.appUserRepository =
                appUserRepository;
    }

    public Supplier360Response find(
            UUID currentUserId,
            UUID supplierId
    ) {
        AppUserEntity user =
                appUserRepository
                        .findById(
                                currentUserId
                        )
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Authenticated ProcureIQ user not found."
                                        )
                        );

        if (!user.isActive()) {
            throw new IllegalArgumentException(
                    "The authenticated ProcureIQ account is inactive."
            );
        }

        SupplierEntity supplier =
                supplierRepository
                        .findById(
                                supplierId
                        )
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Supplier not found: "
                                                        + supplierId
                                        )
                        );

        long submittedQuotations =
                supplier360Repository
                        .submittedQuotationCount(
                                supplierId
                        );

        long awards =
                supplier360Repository
                        .awardCount(
                                supplierId
                        );

        BigDecimal winRate =
                submittedQuotations == 0
                        ? BigDecimal.ZERO
                                .setScale(2)
                        : BigDecimal.valueOf(
                                awards
                        )
                                .multiply(
                                        HUNDRED
                                )
                                .divide(
                                        BigDecimal.valueOf(
                                                submittedQuotations
                                        ),
                                        2,
                                        RoundingMode.HALF_UP
                                )
                                .min(
                                        HUNDRED
                                );

        Supplier360Repository.DeliveryPerformanceRow
                deliveryPerformance =
                supplier360Repository
                        .deliveryPerformance(
                                supplierId
                        );

        List<Supplier360Repository.CategorySpendRow>
                categoryRows =
                supplier360Repository
                        .categorySpend(
                                supplierId
                        );

        BigDecimal categoryTotal =
                categoryRows.stream()
                        .map(
                                Supplier360Repository.CategorySpendRow::
                                        amount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        return new Supplier360Response(
                supplier.getId(),
                supplier.getSupplierCode(),
                supplier.getLegalName(),
                supplier.getCategory(),
                supplier.getCountry(),
                supplier.getStatus(),
                supplier.getRiskLevel(),
                supplier.getRating(),

                supplier360Repository
                        .committedSpend(
                                supplierId
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),

                supplier360Repository
                        .purchaseOrderCount(
                                supplierId
                        ),

                supplier360Repository
                        .openPurchaseOrderCount(
                                supplierId
                        ),

                supplier360Repository
                        .overduePurchaseOrderCount(
                                supplierId
                        ),

                supplier360Repository
                        .invitedRfqCount(
                                supplierId
                        ),

                submittedQuotations,
                awards,
                winRate,

                supplier360Repository
                        .averageAwardValue(
                                supplierId
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),

                deliveryPerformance
                        .trackedOrders(),

                deliveryPerformance
                        .completedOrders(),

                deliveryPerformance
                        .onTimeOrders(),

                deliveryPerformance
                        .lateOrders(),

                deliveryPerformance
                        .onTimeDeliveryRate(),

                deliveryPerformance
                        .fulfillmentRate(),

                deliveryPerformance
                        .lastReceiptDate(),

                supplier360Repository
                        .monthlySpend(
                                supplierId
                        )
                        .stream()
                        .map(
                                row ->
                                        new Supplier360MonthlySpendResponse(
                                                row.month(),
                                                row.amount(),
                                                row.orderCount()
                                        )
                        )
                        .toList(),

                categoryRows.stream()
                        .map(
                                row ->
                                        new Supplier360CategorySpendResponse(
                                                row.category(),
                                                row.amount(),
                                                row.lineCount(),
                                                share(
                                                        row.amount(),
                                                        categoryTotal
                                                )
                                        )
                        )
                        .toList(),

                supplier360Repository
                        .recentPurchaseOrders(
                                supplierId
                        )
                        .stream()
                        .map(
                                row ->
                                        new Supplier360PurchaseOrderResponse(
                                                row.id(),
                                                row.poNumber(),
                                                row.rfqNumber(),
                                                row.status(),
                                                row.totalAmount(),
                                                row.expectedDeliveryDate(),
                                                row.issuedAt(),
                                                row.createdAt()
                                        )
                        )
                        .toList(),

                supplier360Repository
                        .recentSourcing(
                                supplierId
                        )
                        .stream()
                        .map(
                                row ->
                                        new Supplier360SourcingResponse(
                                                row.rfqId(),
                                                row.rfqNumber(),
                                                row.title(),
                                                row.rfqStatus(),
                                                row.invitationStatus(),
                                                row.responseDeadline(),
                                                row.quotationNumber(),
                                                row.quotationStatus(),
                                                row.quotationTotal(),
                                                row.quotationSubmittedAt()
                                        )
                        )
                        .toList(),

                supplier360Repository
                        .recentAwards(
                                supplierId
                        )
                        .stream()
                        .map(
                                row ->
                                        new Supplier360AwardResponse(
                                                row.rfqId(),
                                                row.rfqNumber(),
                                                row.quotationId(),
                                                row.quotationNumber(),
                                                row.awardValue(),
                                                row.manualOverride(),
                                                row.decidedAt()
                                        )
                        )
                        .toList(),

                supplier360Repository
                        .recentActivity(
                                supplierId
                        )
                        .stream()
                        .map(
                                row ->
                                        new Supplier360ActivityResponse(
                                                row.eventType(),
                                                row.title(),
                                                row.detail(),
                                                row.href(),
                                                row.occurredAt()
                                        )
                        )
                        .toList()
        );
    }

    private BigDecimal share(
            BigDecimal amount,
            BigDecimal total
    ) {
        if (
                total.compareTo(
                        BigDecimal.ZERO
                ) == 0
        ) {
            return BigDecimal.ZERO
                    .setScale(2);
        }

        return amount
                .multiply(
                        HUNDRED
                )
                .divide(
                        total,
                        2,
                        RoundingMode.HALF_UP
                );
    }
}
