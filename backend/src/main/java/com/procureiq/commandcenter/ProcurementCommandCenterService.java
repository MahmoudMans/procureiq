package com.procureiq.commandcenter;

import com.procureiq.budget.BudgetAlertLevel;
import com.procureiq.budget.BudgetAlertResponse;
import com.procureiq.budget.BudgetControlService;
import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ProcurementCommandCenterService {

    private final ProcurementCommandCenterRepository repository;
    private final CommandCenterPriorityService priorityService;
    private final BudgetControlService budgetControlService;
    private final AppUserRepository appUserRepository;

    public ProcurementCommandCenterService(
            ProcurementCommandCenterRepository repository,
            CommandCenterPriorityService priorityService,
            BudgetControlService budgetControlService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.priorityService =
                priorityService;

        this.budgetControlService =
                budgetControlService;

        this.appUserRepository =
                appUserRepository;
    }

    public CommandCenterResponse dashboard(
            UUID currentUserId,
            Integer requestedHorizonDays,
            String requestedCurrency
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertRole(
                user.getRole()
        );

        int horizonDays =
                normalizeHorizon(
                        requestedHorizonDays
                );

        String currency =
                normalizeCurrency(
                        requestedCurrency
                );

        LocalDate today =
                LocalDate.now(
                        ZoneOffset.UTC
                );

        int fiscalYear =
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue();

        List<CommandCenterActionResponse> actions =
                new ArrayList<>();

        actions.addAll(
                repository.pendingRequests(
                        today
                )
        );

        actions.addAll(
                repository.rfqDeadlines(
                        today,
                        horizonDays
                )
        );

        actions.addAll(
                repository.overduePurchaseOrders(
                        today
                )
        );

        actions.addAll(
                repository.contractExpiries(
                        today,
                        horizonDays
                )
        );

        actions.addAll(
                repository.complianceExpiries(
                        today,
                        horizonDays
                )
        );

        actions.addAll(
                repository.procurementRisks(
                        today
                )
        );

        actions.addAll(
                budgetActions(
                        currentUserId,
                        fiscalYear,
                        currency
                )
        );

        actions.addAll(
                repository.upcomingDemand(
                        today,
                        horizonDays
                )
        );

        actions.addAll(
                repository.savingsActions(
                        today,
                        fiscalYear,
                        currency
                )
        );

        actions.sort(
                Comparator.comparingInt(
                        (CommandCenterActionResponse action) ->
                                priorityService
                                        .priorityScore(
                                                action.severity(),
                                                action.dueDate(),
                                                today
                                        )
                )
                        .reversed()
                        .thenComparing(
                                (CommandCenterActionResponse action) ->
                                        action.dueDate()
                                                == null
                                                ? LocalDate.MAX
                                                : action.dueDate()
                        )
        );

        List<CommandCenterActionResponse> limitedActions =
                actions.stream()
                        .limit(100)
                        .toList();

        return new CommandCenterResponse(
                Instant.now(),
                horizonDays,
                summary(
                        actions,
                        fiscalYear,
                        currency
                ),
                breakdown(
                        actions
                ),
                limitedActions
        );
    }

    private List<CommandCenterActionResponse>
    budgetActions(
            UUID currentUserId,
            int fiscalYear,
            String currency
    ) {
        List<BudgetAlertResponse> alerts =
                budgetControlService
                        .alerts(
                                currentUserId,
                                fiscalYear,
                                currency
                        );

        return alerts.stream()
                .map(
                        alert -> {
                            CommandCenterSeverity severity;

                            if (
                                    alert.alertLevel()
                                            == BudgetAlertLevel.EXCEEDED
                            ) {
                                severity =
                                        alert.hardLimit()
                                                ? CommandCenterSeverity.CRITICAL
                                                : CommandCenterSeverity.HIGH;
                            } else {
                                severity =
                                        CommandCenterSeverity.MEDIUM;
                            }

                            return new CommandCenterActionResponse(
                                    alert.allocationId(),
                                    CommandCenterActionType.BUDGET_EXCEPTION,
                                    severity,
                                    alert.alertLevel()
                                            == BudgetAlertLevel.EXCEEDED
                                            ? "Procurement budget exceeded"
                                            : "Procurement budget warning",
                                    alert.message(),
                                    alert.scopeLabel(),
                                    null,
                                    null,
                                    false,
                                    alert.remainingForecast()
                                            .abs(),
                                    alert.currency(),
                                    null,
                                    "/budgets"
                            );
                        }
                )
                .toList();
    }

    private CommandCenterSummaryResponse summary(
            List<CommandCenterActionResponse> actions,
            int fiscalYear,
            String currency
    ) {
        long critical =
                actions.stream()
                        .filter(
                                action ->
                                        action.severity()
                                                == CommandCenterSeverity.CRITICAL
                        )
                        .count();

        long high =
                actions.stream()
                        .filter(
                                action ->
                                        action.severity()
                                                == CommandCenterSeverity.HIGH
                        )
                        .count();

        long overdue =
                actions.stream()
                        .filter(
                                CommandCenterActionResponse::
                                        overdue
                        )
                        .count();

        return new CommandCenterSummaryResponse(
                actions.size(),
                critical,
                high,
                overdue,

                count(
                        actions,
                        CommandCenterActionType.PENDING_REQUEST
                ),

                count(
                        actions,
                        CommandCenterActionType.RFQ_DEADLINE
                ),

                count(
                        actions,
                        CommandCenterActionType.OVERDUE_PURCHASE_ORDER
                ),

                count(
                        actions,
                        CommandCenterActionType.CONTRACT_EXPIRY
                )
                        +
                        count(
                                actions,
                                CommandCenterActionType.COMPLIANCE_EXPIRY
                        ),

                actions.stream()
                        .filter(
                                action ->
                                        action.type()
                                                == CommandCenterActionType.PROCUREMENT_RISK
                                        &&
                                        action.severity()
                                                == CommandCenterSeverity.CRITICAL
                        )
                        .count(),

                count(
                        actions,
                        CommandCenterActionType.BUDGET_EXCEPTION
                ),

                count(
                        actions,
                        CommandCenterActionType.PLANNING_DEMAND
                ),

                count(
                        actions,
                        CommandCenterActionType.SAVINGS_VALIDATION
                )
                        +
                        count(
                                actions,
                                CommandCenterActionType.SAVINGS_REALIZATION
                        ),

                money(
                        repository
                                .realizedSavings(
                                        fiscalYear,
                                        currency
                                )
                ),

                currency
        );
    }

    private List<CommandCenterBreakdownResponse>
    breakdown(
            List<CommandCenterActionResponse> actions
    ) {
        return List.of(
                        CommandCenterActionType.values()
                )
                .stream()
                .map(
                        type -> {
                            List<CommandCenterActionResponse> matching =
                                    actions.stream()
                                            .filter(
                                                    action ->
                                                            action.type()
                                                                    == type
                                            )
                                            .toList();

                            return new CommandCenterBreakdownResponse(
                                    type,
                                    matching.size(),

                                    matching.stream()
                                            .filter(
                                                    action ->
                                                            action.severity()
                                                                    == CommandCenterSeverity.CRITICAL
                                            )
                                            .count(),

                                    matching.stream()
                                            .filter(
                                                    action ->
                                                            action.severity()
                                                                    == CommandCenterSeverity.HIGH
                                            )
                                            .count(),

                                    matching.stream()
                                            .filter(
                                                    CommandCenterActionResponse::
                                                            overdue
                                            )
                                            .count()
                            );
                        }
                )
                .filter(
                        item ->
                                item.total()
                                        > 0
                )
                .toList();
    }

    private long count(
            List<CommandCenterActionResponse> actions,
            CommandCenterActionType type
    ) {
        return actions.stream()
                .filter(
                        action ->
                                action.type()
                                        == type
                )
                .count();
    }

    private int normalizeHorizon(
            Integer requested
    ) {
        if (requested == null) {
            return 60;
        }

        return Math.max(
                7,
                Math.min(
                        requested,
                        365
                )
        );
    }

    private String normalizeCurrency(
            String requested
    ) {
        if (
                requested == null
                ||
                requested.isBlank()
        ) {
            return "EUR";
        }

        String currency =
                requested.trim()
                        .toUpperCase(
                                Locale.ROOT
                        );

        if (
                currency.length()
                        != 3
        ) {
            throw new IllegalArgumentException(
                    "Currency must contain exactly three characters."
            );
        }

        return currency;
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

    private void assertRole(
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
                    "Your ProcureIQ role cannot access the procurement command center."
            );
        }
    }
}
