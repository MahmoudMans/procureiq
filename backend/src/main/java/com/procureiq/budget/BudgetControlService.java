package com.procureiq.budget;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class BudgetControlService {

    private final BudgetRepository
            budgetRepository;

    private final BudgetCalculationService
            calculationService;

    private final AppUserRepository
            appUserRepository;

    public BudgetControlService(
            BudgetRepository budgetRepository,
            BudgetCalculationService calculationService,
            AppUserRepository appUserRepository
    ) {
        this.budgetRepository =
                budgetRepository;

        this.calculationService =
                calculationService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public List<BudgetAllocationResponse>
    allocations(
            UUID currentUserId,
            Integer requestedYear,
            String requestedCurrency
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertReadRole(
                user.getRole()
        );

        FiscalContext context =
                context(
                        requestedYear,
                        requestedCurrency
                );

        return budgetRepository
                .findActive(
                        context.fiscalYear(),
                        context.currency()
                )
                .stream()
                .map(
                        this::allocationResponse
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BudgetUsageResponse> usage(
            UUID currentUserId,
            Integer requestedYear,
            String requestedCurrency
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertReadRole(
                user.getRole()
        );

        FiscalContext context =
                context(
                        requestedYear,
                        requestedCurrency
                );

        return budgetRepository
                .findActive(
                        context.fiscalYear(),
                        context.currency()
                )
                .stream()
                .map(
                        allocation ->
                                usageFor(
                                        allocation,
                                        null
                                )
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public BudgetSummaryResponse summary(
            UUID currentUserId,
            Integer requestedYear,
            String requestedCurrency
    ) {
        List<BudgetUsageResponse> usages =
                usage(
                        currentUserId,
                        requestedYear,
                        requestedCurrency
                );

        FiscalContext context =
                context(
                        requestedYear,
                        requestedCurrency
                );

        BigDecimal totalBudget =
                sum(
                        usages.stream()
                                .map(
                                        BudgetUsageResponse::
                                                budgetAmount
                                )
                                .toList()
                );

        BigDecimal committed =
                sum(
                        usages.stream()
                                .map(
                                        BudgetUsageResponse::
                                                committedSpend
                                )
                                .toList()
                );

        BigDecimal pipeline =
                sum(
                        usages.stream()
                                .map(
                                        BudgetUsageResponse::
                                                openRequestExposure
                                )
                                .toList()
                );

        BigDecimal forecast =
                committed.add(
                        pipeline
                );

        long warning =
                usages.stream()
                        .filter(
                                item ->
                                        item.alertLevel()
                                                == BudgetAlertLevel.WARNING
                        )
                        .count();

        long exceeded =
                usages.stream()
                        .filter(
                                item ->
                                        item.alertLevel()
                                                == BudgetAlertLevel.EXCEEDED
                        )
                        .count();

        return new BudgetSummaryResponse(
                context.fiscalYear(),
                context.currency(),
                usages.size(),
                money(totalBudget),
                money(committed),
                money(pipeline),
                money(forecast),
                money(
                        totalBudget.subtract(
                                forecast
                        )
                ),
                calculationService
                        .utilizationPercent(
                                committed,
                                totalBudget
                        ),
                calculationService
                        .utilizationPercent(
                                forecast,
                                totalBudget
                        ),
                warning,
                exceeded
        );
    }

    @Transactional(readOnly = true)
    public List<BudgetAlertResponse> alerts(
            UUID currentUserId,
            Integer requestedYear,
            String requestedCurrency
    ) {
        return usage(
                currentUserId,
                requestedYear,
                requestedCurrency
        )
                .stream()
                .filter(
                        usage ->
                                usage.alertLevel()
                                        != BudgetAlertLevel.HEALTHY
                )
                .map(
                        usage ->
                                new BudgetAlertResponse(
                                        usage.allocationId(),
                                        usage.scopeType(),
                                        usage.scopeLabel(),
                                        usage.currency(),
                                        usage.alertLevel(),
                                        usage.forecastUtilizationPercent(),
                                        usage.remainingForecast(),
                                        usage.hardLimit(),
                                        alertMessage(
                                                usage
                                        )
                                )
                )
                .toList();
    }

    public BudgetAllocationResponse create(
            UUID currentUserId,
            BudgetAllocationInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                user.getRole()
        );

        validateInput(
                input
        );

        UUID ownerId =
                input.ownerUserId() == null
                        ? currentUserId
                        : findAssignableUser(
                                input.ownerUserId()
                        )
                                .getId();

        UUID id =
                UUID.randomUUID();

        try {
            budgetRepository.create(
                    id,
                    input,
                    ownerId,
                    normalizedCategory(
                            input
                    ),
                    normalizedCurrency(
                            input.currency()
                    )
            );
        } catch (
                DataIntegrityViolationException exception
        ) {
            throw new IllegalArgumentException(
                    "An active budget already exists for this fiscal-year scope and currency."
            );
        }

        return allocationResponse(
                requireAllocation(
                        id
                )
        );
    }

    public BudgetAllocationResponse update(
            UUID currentUserId,
            UUID allocationId,
            BudgetAllocationInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                user.getRole()
        );

        BudgetRepository.BudgetAllocationRow existing =
                requireAllocation(
                        allocationId
                );

        if (
                existing.status()
                        != BudgetStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Archived budgets cannot be edited."
            );
        }

        validateInput(
                input
        );

        UUID ownerId =
                input.ownerUserId() == null
                        ? existing.ownerUserId()
                        : findAssignableUser(
                                input.ownerUserId()
                        )
                                .getId();

        try {
            budgetRepository.update(
                    allocationId,
                    input,
                    ownerId,
                    normalizedCategory(
                            input
                    ),
                    normalizedCurrency(
                            input.currency()
                    )
            );
        } catch (
                DataIntegrityViolationException exception
        ) {
            throw new IllegalArgumentException(
                    "An active budget already exists for this fiscal-year scope and currency."
            );
        }

        return allocationResponse(
                requireAllocation(
                        allocationId
                )
        );
    }

    public void archive(
            UUID currentUserId,
            UUID allocationId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                user.getRole()
        );

        requireAllocation(
                allocationId
        );

        budgetRepository.archive(
                allocationId
        );
    }

    @Transactional(readOnly = true)
    public PurchaseRequestBudgetCheckResponse
    checkPurchaseRequest(
            UUID currentUserId,
            UUID requestId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertReadRole(
                user.getRole()
        );

        BudgetRepository.PurchaseRequestRow request =
                budgetRepository
                        .findPurchaseRequest(
                                requestId
                        );

        if (request == null) {
            throw new ResourceNotFoundException(
                    "Purchase request not found: "
                            + requestId
            );
        }

        int fiscalYear =
                request.createdAt()
                        .atZone(
                                ZoneOffset.UTC
                        )
                        .getYear();

        BudgetRepository.BudgetAllocationRow allocation =
                budgetRepository
                        .findDepartmentBudget(
                                fiscalYear,
                                request.departmentId(),
                                request.currency()
                        );

        if (allocation == null) {
            return new PurchaseRequestBudgetCheckResponse(
                    request.id(),
                    request.requestNumber(),
                    request.departmentId(),
                    request.departmentName(),
                    request.currency(),
                    money(
                            request.estimatedTotal()
                    ),
                    false,
                    null,
                    BigDecimal.ZERO
                            .setScale(2),
                    BigDecimal.ZERO
                            .setScale(2),
                    money(
                            request.estimatedTotal()
                    ),
                    BigDecimal.ZERO
                            .setScale(2),
                    BigDecimal.ZERO
                            .setScale(2),
                    BigDecimal.ZERO
                            .setScale(2),
                    false,
                    false,
                    BudgetAlertLevel.WARNING,
                    "No active department budget is configured for this request."
            );
        }

        BigDecimal committed =
                budgetRepository
                        .committedSpend(
                                allocation
                        );

        BigDecimal pipelineWithoutRequest =
                budgetRepository
                        .openRequestExposure(
                                allocation,
                                request.id()
                        );

        BigDecimal currentForecast =
                committed.add(
                        pipelineWithoutRequest
                );

        BigDecimal projected =
                currentForecast.add(
                        request.estimatedTotal()
                );

        BigDecimal utilization =
                calculationService
                        .utilizationPercent(
                                projected,
                                allocation.budgetAmount()
                        );

        BigDecimal remaining =
                calculationService
                        .remaining(
                                allocation.budgetAmount(),
                                projected
                        );

        BudgetAlertLevel level =
                calculationService
                        .alertLevel(
                                utilization,
                                allocation.warningThresholdPercent()
                        );

        boolean blocked =
                allocation.hardLimit()
                &&
                level == BudgetAlertLevel.EXCEEDED;

        return new PurchaseRequestBudgetCheckResponse(
                request.id(),
                request.requestNumber(),
                request.departmentId(),
                request.departmentName(),
                request.currency(),
                money(
                        request.estimatedTotal()
                ),
                true,
                allocation.id(),
                money(
                        allocation.budgetAmount()
                ),
                money(
                        currentForecast
                ),
                money(
                        projected
                ),
                utilization,
                money(
                        remaining
                ),
                allocation.warningThresholdPercent(),
                allocation.hardLimit(),
                blocked,
                level,
                checkMessage(
                        blocked,
                        level,
                        remaining
                )
        );
    }

    @Transactional(readOnly = true)
    public BudgetContextOptionsResponse
    contextOptions(
            UUID currentUserId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertReadRole(
                user.getRole()
        );

        return new BudgetContextOptionsResponse(
                budgetRepository
                        .departments(),
                budgetRepository
                        .users(),
                budgetRepository
                        .purchaseRequests(),
                budgetRepository
                        .categories()
        );
    }

    private BudgetUsageResponse usageFor(
            BudgetRepository.BudgetAllocationRow allocation,
            UUID excludedRequestId
    ) {
        BigDecimal committed =
                budgetRepository
                        .committedSpend(
                                allocation
                        );

        BigDecimal pipeline =
                budgetRepository
                        .openRequestExposure(
                                allocation,
                                excludedRequestId
                        );

        BigDecimal forecast =
                committed.add(
                        pipeline
                );

        BigDecimal utilization =
                calculationService
                        .utilizationPercent(
                                committed,
                                allocation.budgetAmount()
                        );

        BigDecimal forecastUtilization =
                calculationService
                        .utilizationPercent(
                                forecast,
                                allocation.budgetAmount()
                        );

        return new BudgetUsageResponse(
                allocation.id(),
                allocation.fiscalYear(),
                allocation.scopeType(),
                scopeLabel(
                        allocation
                ),
                allocation.currency(),
                money(
                        allocation.budgetAmount()
                ),
                money(committed),
                money(pipeline),
                money(forecast),
                calculationService
                        .remaining(
                                allocation.budgetAmount(),
                                committed
                        ),
                calculationService
                        .remaining(
                                allocation.budgetAmount(),
                                forecast
                        ),
                utilization,
                forecastUtilization,
                allocation.warningThresholdPercent(),
                allocation.hardLimit(),
                calculationService
                        .alertLevel(
                                forecastUtilization,
                                allocation.warningThresholdPercent()
                        )
        );
    }

    private BudgetAllocationResponse allocationResponse(
            BudgetRepository.BudgetAllocationRow row
    ) {
        return new BudgetAllocationResponse(
                row.id(),
                row.fiscalYear(),
                row.scopeType(),
                row.departmentId(),
                row.departmentName(),
                row.category(),
                scopeLabel(row),
                row.currency(),
                money(
                        row.budgetAmount()
                ),
                row.warningThresholdPercent(),
                row.hardLimit(),
                row.status(),
                row.ownerUserId(),
                row.ownerName(),
                row.notes(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private BudgetRepository.BudgetAllocationRow
    requireAllocation(
            UUID allocationId
    ) {
        BudgetRepository.BudgetAllocationRow row =
                budgetRepository
                        .findById(
                                allocationId
                        );

        if (row == null) {
            throw new ResourceNotFoundException(
                    "Budget allocation not found: "
                            + allocationId
            );
        }

        return row;
    }

    private void validateInput(
            BudgetAllocationInput input
    ) {
        if (
                input.scopeType()
                        == BudgetScopeType.DEPARTMENT
                &&
                input.departmentId()
                        == null
        ) {
            throw new IllegalArgumentException(
                    "Department budgets require a department."
            );
        }

        if (
                input.scopeType()
                        == BudgetScopeType.CATEGORY
                &&
                (
                        input.category()
                                == null
                        ||
                        input.category()
                                .isBlank()
                )
        ) {
            throw new IllegalArgumentException(
                    "Category budgets require a category."
            );
        }

        if (
                input.currency() == null
                ||
                input.currency()
                        .trim()
                        .length() != 3
        ) {
            throw new IllegalArgumentException(
                    "Budget currency must contain exactly three characters."
            );
        }
    }

    private String scopeLabel(
            BudgetRepository.BudgetAllocationRow row
    ) {
        return row.scopeType()
                        == BudgetScopeType.DEPARTMENT
                ? row.departmentName()
                : row.category();
    }

    private String normalizedCategory(
            BudgetAllocationInput input
    ) {
        if (
                input.scopeType()
                        != BudgetScopeType.CATEGORY
        ) {
            return null;
        }

        return input.category()
                .trim();
    }

    private String normalizedCurrency(
            String currency
    ) {
        return currency
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    private FiscalContext context(
            Integer requestedYear,
            String requestedCurrency
    ) {
        int year =
                requestedYear == null
                        ? Year.now(
                                ZoneOffset.UTC
                        )
                                .getValue()
                        : requestedYear;

        String currency =
                requestedCurrency == null
                        ||
                        requestedCurrency
                                .isBlank()
                        ? "EUR"
                        : normalizedCurrency(
                                requestedCurrency
                        );

        return new FiscalContext(
                year,
                currency
        );
    }

    private BigDecimal sum(
            List<BigDecimal> values
    ) {
        return values.stream()
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal money(
            BigDecimal value
    ) {
        if (value == null) {
            return BigDecimal.ZERO
                    .setScale(2);
        }

        return value.setScale(
                2,
                RoundingMode.HALF_UP
        );
    }

    private String alertMessage(
            BudgetUsageResponse usage
    ) {
        if (
                usage.alertLevel()
                        == BudgetAlertLevel.EXCEEDED
        ) {
            return usage.scopeLabel()
                    + " forecast exceeds budget by "
                    + usage.remainingForecast()
                            .abs()
                            .toPlainString()
                    + " "
                    + usage.currency()
                    + ".";
        }

        return usage.scopeLabel()
                + " has reached "
                + usage.forecastUtilizationPercent()
                        .toPlainString()
                + "% forecast utilization.";
    }

    private String checkMessage(
            boolean blocked,
            BudgetAlertLevel level,
            BigDecimal remaining
    ) {
        if (blocked) {
            return "Request exceeds a hard budget limit and requires budget adjustment before commitment.";
        }

        if (
                level == BudgetAlertLevel.EXCEEDED
        ) {
            return "Request would exceed the configured budget, but this allocation is not configured as a hard limit.";
        }

        if (
                level == BudgetAlertLevel.WARNING
        ) {
            return "Request remains within budget but crosses the configured warning threshold.";
        }

        return "Request remains within the configured department budget with "
                + remaining.toPlainString()
                + " remaining after forecast.";
    }

    private AppUserEntity findCurrentUser(
            UUID userId
    ) {
        AppUserEntity user =
                appUserRepository
                        .findById(
                                userId
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

        return user;
    }

    private AppUserEntity findAssignableUser(
            UUID userId
    ) {
        AppUserEntity user =
                appUserRepository
                        .findById(
                                userId
                        )
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Budget owner not found: "
                                                        + userId
                                        )
                        );

        if (!user.isActive()) {
            throw new IllegalArgumentException(
                    "Budget owner must be an active ProcureIQ user."
            );
        }

        if (
                user.getRole()
                        == ProcurementRole.REQUESTER
        ) {
            throw new IllegalArgumentException(
                    "Budget owners must have a procurement governance role."
            );
        }

        return user;
    }

    private void assertReadRole(
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
                    "Your ProcureIQ role cannot access budget control."
            );
        }
    }

    private void assertWriteRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can manage budget allocations."
            );
        }
    }

    private record FiscalContext(
            int fiscalYear,
            String currency
    ) {
    }
}
