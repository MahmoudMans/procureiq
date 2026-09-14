package com.procureiq.reporting;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ReportingService {

    private static final BigDecimal HUNDRED =
            new BigDecimal("100.00");

    private final ReportingRepository
            reportingRepository;

    private final ReportSnapshotRepository
            snapshotRepository;

    private final AppUserRepository
            appUserRepository;

    public ReportingService(
            ReportingRepository reportingRepository,
            ReportSnapshotRepository snapshotRepository,
            AppUserRepository appUserRepository
    ) {
        this.reportingRepository =
                reportingRepository;

        this.snapshotRepository =
                snapshotRepository;

        this.appUserRepository =
                appUserRepository;
    }

    public ExecutiveReportResponse executiveReport(
            UUID currentUserId,
            LocalDate requestedFrom,
            LocalDate requestedTo
    ) {
        AppUserEntity user =
                findUser(
                        currentUserId
                );

        assertReportingRole(
                user.getRole()
        );

        Period period =
                resolvePeriod(
                        requestedFrom,
                        requestedTo
                );

        BigDecimal committedSpend =
                reportingRepository
                        .committedSpend(
                                period.from(),
                                period.to()
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        long orderCount =
                reportingRepository
                        .purchaseOrderCount(
                                period.from(),
                                period.to()
                        );

        BigDecimal averageOrderValue =
                orderCount == 0
                        ? BigDecimal.ZERO
                                .setScale(2)
                        : committedSpend.divide(
                                BigDecimal.valueOf(
                                        orderCount
                                ),
                                2,
                                RoundingMode.HALF_UP
                        );

        ReportSummaryResponse summary =
                new ReportSummaryResponse(
                        committedSpend,
                        reportingRepository
                                .sourcingSavings(
                                        period.from(),
                                        period.to()
                                )
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                ),
                        orderCount,
                        reportingRepository
                                .supplierCount(
                                        period.from(),
                                        period.to()
                                ),
                        reportingRepository
                                .overdueOrderCount(
                                        period.from(),
                                        period.to()
                                ),
                        reportingRepository
                                .averageCycleDays(
                                        period.from(),
                                        period.to()
                                )
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                ),
                        averageOrderValue
                );

        return new ExecutiveReportResponse(
                period.from(),
                period.to(),
                summary,
                withShare(
                        reportingRepository
                                .spendBySupplier(
                                        period.from(),
                                        period.to()
                                )
                ),
                withShare(
                        reportingRepository
                                .spendByCategory(
                                        period.from(),
                                        period.to()
                                )
                ),
                reportingRepository
                        .sourcingRows(
                                period.from(),
                                period.to()
                        ),
                reportingRepository
                        .purchaseOrders(
                                period.from(),
                                period.to()
                        ),
                reportingRepository
                        .deliveries(
                                period.from(),
                                period.to()
                        )
        );
    }

    public String exportCsv(
            UUID currentUserId,
            ReportType reportType,
            LocalDate requestedFrom,
            LocalDate requestedTo
    ) {
        ExecutiveReportResponse report =
                executiveReport(
                        currentUserId,
                        requestedFrom,
                        requestedTo
                );

        return switch (reportType) {
            case EXECUTIVE ->
                    executiveCsv(report);

            case SUPPLIER_SPEND ->
                    breakdownCsv(
                            "Supplier",
                            report.spendBySupplier()
                    );

            case CATEGORY_SPEND ->
                    breakdownCsv(
                            "Category",
                            report.spendByCategory()
                    );

            case SOURCING_SAVINGS ->
                    sourcingCsv(
                            report.sourcingSavings()
                    );

            case PURCHASE_ORDERS ->
                    purchaseOrderCsv(
                            report.purchaseOrders()
                    );

            case DELIVERIES ->
                    deliveryCsv(
                            report.deliveries()
                    );
        };
    }

    @Transactional
    public ReportSnapshotResponse createSnapshot(
            UUID currentUserId,
            ReportSnapshotInput input
    ) {
        AppUserEntity user =
                findUser(
                        currentUserId
                );

        assertReportingRole(
                user.getRole()
        );

        Period period =
                resolvePeriod(
                        input.periodStart(),
                        input.periodEnd()
                );

        String payload =
                exportCsv(
                        currentUserId,
                        input.reportType(),
                        period.from(),
                        period.to()
                );

        UUID snapshotId =
                UUID.randomUUID();

        snapshotRepository.create(
                snapshotId,
                input.reportType(),
                period.from(),
                period.to(),
                input.label().trim(),
                payload,
                currentUserId
        );

        return snapshotRepository
                .findRecent()
                .stream()
                .filter(
                        snapshot ->
                                snapshot.id()
                                        .equals(
                                                snapshotId
                                        )
                )
                .findFirst()
                .orElseThrow(
                        () ->
                                new IllegalStateException(
                                        "Created report snapshot could not be reloaded."
                                )
                );
    }

    public List<ReportSnapshotResponse> snapshots(
            UUID currentUserId
    ) {
        AppUserEntity user =
                findUser(
                        currentUserId
                );

        assertReportingRole(
                user.getRole()
        );

        return snapshotRepository
                .findRecent();
    }

    private List<ReportBreakdownResponse> withShare(
            List<ReportingRepository.ValueRow> rows
    ) {
        BigDecimal total =
                rows.stream()
                        .map(
                                ReportingRepository.ValueRow::
                                        amount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        return rows.stream()
                .map(
                        row ->
                                new ReportBreakdownResponse(
                                        row.label(),
                                        row.amount(),
                                        row.count(),
                                        share(
                                                row.amount(),
                                                total
                                        )
                                )
                )
                .toList();
    }

    private BigDecimal share(
            BigDecimal value,
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

        return value
                .multiply(
                        HUNDRED
                )
                .divide(
                        total,
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private String executiveCsv(
            ExecutiveReportResponse report
    ) {
        StringBuilder csv =
                new StringBuilder();

        csv.append(
                "Metric,Value\n"
        );

        csv.append(
                csvCell(
                        "Period start"
                )
        ).append(',')
                .append(
                        csvCell(
                                report.periodStart()
                                        .toString()
                        )
                )
                .append('\n');

        csv.append(
                csvCell(
                        "Period end"
                )
        ).append(',')
                .append(
                        csvCell(
                                report.periodEnd()
                                        .toString()
                        )
                )
                .append('\n');

        appendMetric(
                csv,
                "Committed spend",
                report.summary()
                        .committedSpend()
                        .toPlainString()
        );

        appendMetric(
                csv,
                "Sourcing savings",
                report.summary()
                        .sourcingSavings()
                        .toPlainString()
        );

        appendMetric(
                csv,
                "Purchase order count",
                Long.toString(
                        report.summary()
                                .purchaseOrderCount()
                )
        );

        appendMetric(
                csv,
                "Supplier count",
                Long.toString(
                        report.summary()
                                .supplierCount()
                )
        );

        appendMetric(
                csv,
                "Overdue order count",
                Long.toString(
                        report.summary()
                                .overdueOrderCount()
                )
        );

        appendMetric(
                csv,
                "Average procurement cycle days",
                report.summary()
                        .averageCycleDays()
                        .toPlainString()
        );

        appendMetric(
                csv,
                "Average order value",
                report.summary()
                        .averageOrderValue()
                        .toPlainString()
        );

        return csv.toString();
    }

    private String breakdownCsv(
            String heading,
            List<ReportBreakdownResponse> rows
    ) {
        StringBuilder csv =
                new StringBuilder();

        csv.append(
                csvCell(heading)
        ).append(
                ",Amount,Count,Share Percent\n"
        );

        for (
                ReportBreakdownResponse row
                : rows
        ) {
            csv.append(
                    csvCell(
                            row.label()
                    )
            ).append(',')
                    .append(
                            row.amount()
                                    .toPlainString()
                    )
                    .append(',')
                    .append(
                            row.count()
                    )
                    .append(',')
                    .append(
                            row.sharePercent()
                                    .toPlainString()
                    )
                    .append('\n');
        }

        return csv.toString();
    }

    private String sourcingCsv(
            List<SourcingSavingsReportRow> rows
    ) {
        StringBuilder csv =
                new StringBuilder(
                        "RFQ,Supplier,Selected Total,Highest Submitted Total,Savings,Award Date\n"
                );

        for (
                SourcingSavingsReportRow row
                : rows
        ) {
            csv.append(
                    csvCell(
                            row.rfqNumber()
                    )
            ).append(',')
                    .append(
                            csvCell(
                                    row.supplierName()
                            )
                    )
                    .append(',')
                    .append(
                            row.selectedTotal()
                                    .toPlainString()
                    )
                    .append(',')
                    .append(
                            row.highestSubmittedTotal()
                                    .toPlainString()
                    )
                    .append(',')
                    .append(
                            row.savings()
                                    .toPlainString()
                    )
                    .append(',')
                    .append(
                            row.awardDate()
                    )
                    .append('\n');
        }

        return csv.toString();
    }

    private String purchaseOrderCsv(
            List<PurchaseOrderReportRow> rows
    ) {
        StringBuilder csv =
                new StringBuilder(
                        "PO Number,Supplier,Status,Total Amount,Expected Delivery,Issued At\n"
                );

        for (
                PurchaseOrderReportRow row
                : rows
        ) {
            csv.append(
                    csvCell(
                            row.poNumber()
                    )
            ).append(',')
                    .append(
                            csvCell(
                                    row.supplierName()
                            )
                    )
                    .append(',')
                    .append(
                            csvCell(
                                    row.status()
                            )
                    )
                    .append(',')
                    .append(
                            row.totalAmount()
                                    .toPlainString()
                    )
                    .append(',')
                    .append(
                            row.expectedDeliveryDate()
                    )
                    .append(',')
                    .append(
                            row.issuedAt() == null
                                    ? ""
                                    : row.issuedAt()
                    )
                    .append('\n');
        }

        return csv.toString();
    }

    private String deliveryCsv(
            List<DeliveryReportRow> rows
    ) {
        StringBuilder csv =
                new StringBuilder(
                        "PO Number,Supplier,Status,Expected Delivery,Last Receipt,Ordered Quantity,Received Quantity,Fulfillment Percent,Late\n"
                );

        for (
                DeliveryReportRow row
                : rows
        ) {
            csv.append(
                    csvCell(
                            row.poNumber()
                    )
            ).append(',')
                    .append(
                            csvCell(
                                    row.supplierName()
                            )
                    )
                    .append(',')
                    .append(
                            csvCell(
                                    row.status()
                            )
                    )
                    .append(',')
                    .append(
                            row.expectedDeliveryDate()
                    )
                    .append(',')
                    .append(
                            row.lastReceiptDate() == null
                                    ? ""
                                    : row.lastReceiptDate()
                    )
                    .append(',')
                    .append(
                            row.orderedQuantity()
                                    .toPlainString()
                    )
                    .append(',')
                    .append(
                            row.receivedQuantity()
                                    .toPlainString()
                    )
                    .append(',')
                    .append(
                            row.fulfillmentRate()
                                    .setScale(
                                            2,
                                            RoundingMode.HALF_UP
                                    )
                                    .toPlainString()
                    )
                    .append(',')
                    .append(
                            row.late()
                    )
                    .append('\n');
        }

        return csv.toString();
    }

    private void appendMetric(
            StringBuilder csv,
            String metric,
            String value
    ) {
        csv.append(
                csvCell(metric)
        )
                .append(',')
                .append(
                        csvCell(value)
                )
                .append('\n');
    }

    private String csvCell(
            String value
    ) {
        if (value == null) {
            return "";
        }

        String escaped =
                value.replace(
                        "\"",
                        "\"\""
                );

        return "\""
                + escaped
                + "\"";
    }

    private Period resolvePeriod(
            LocalDate requestedFrom,
            LocalDate requestedTo
    ) {
        LocalDate today =
                LocalDate.now(
                        ZoneOffset.UTC
                );

        LocalDate from =
                requestedFrom == null
                        ? LocalDate.of(
                                today.getYear(),
                                1,
                                1
                        )
                        : requestedFrom;

        LocalDate to =
                requestedTo == null
                        ? today
                        : requestedTo;

        if (from.isAfter(to)) {
            throw new IllegalArgumentException(
                    "Report period start must not be after report period end."
            );
        }

        return new Period(
                from,
                to
        );
    }

    private AppUserEntity findUser(
            UUID userId
    ) {
        AppUserEntity user =
                appUserRepository
                        .findById(userId)
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

        return user;
    }

    private void assertReportingRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.BUYER
                &&
                role != ProcurementRole.APPROVER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot access procurement reports."
            );
        }
    }

    private record Period(
            LocalDate from,
            LocalDate to
    ) {
    }
}
