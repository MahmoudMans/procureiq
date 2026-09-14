package com.procureiq.controltower;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class ControlTowerService {

    private final ControlTowerRepository repository;

    private final ControlTowerPriorityService priorityService;

    private final AppUserRepository appUserRepository;

    public ControlTowerService(
            ControlTowerRepository repository,
            ControlTowerPriorityService priorityService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.priorityService =
                priorityService;

        this.appUserRepository =
                appUserRepository;
    }

    public ControlTowerScanResponse scan(
            UUID currentUserId,
            String currency
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String normalizedCurrency =
                normalizeCurrency(
                        currency
                );

        UUID runId =
                UUID.randomUUID();

        repository.createRun(
                runId,
                normalizedCurrency,
                currentUserId
        );

        List<ControlTowerSourceException> sourceExceptions =
                repository
                        .sourceExceptions(
                                normalizedCurrency
                        );

        int discovered =
                0;

        int refreshed =
                0;

        Instant now =
                Instant.now();

        for (
                ControlTowerSourceException source
                : sourceExceptions
        ) {
            boolean existed =
                    repository
                            .itemExists(
                                    source.exceptionKey()
                            );

            ControlTowerPriorityResult priority =
                    priorityService
                            .evaluate(
                                    source,
                                    now
                            );

            repository.upsertItem(
                    runId,
                    normalizedCurrency,
                    source,
                    priority
            );

            if (existed) {
                refreshed++;
            } else {
                discovered++;
            }
        }

        int autoResolved =
                repository
                        .autoResolveStale(
                                runId,
                                normalizedCurrency
                        );

        repository.completeRun(
                runId,
                discovered,
                refreshed,
                autoResolved
        );

        return new ControlTowerScanResponse(
                runId,
                sourceExceptions.size(),
                discovered,
                refreshed,
                autoResolved
        );
    }

    @Transactional(readOnly = true)
    public ControlTowerDashboardResponse dashboard(
            UUID currentUserId,
            String currency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String normalizedCurrency =
                normalizeCurrency(
                        currency
                );

        List<ControlTowerItemResponse> items =
                repository
                        .items(
                                normalizedCurrency
                        )
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList();

        List<ControlTowerItemResponse> active =
                items.stream()
                        .filter(
                                item ->
                                        item.status()
                                                == ControlTowerItemStatus.OPEN
                                        ||
                                        item.status()
                                                == ControlTowerItemStatus.ACKNOWLEDGED
                                        ||
                                        item.status()
                                                == ControlTowerItemStatus.IN_PROGRESS
                        )
                        .toList();

        BigDecimal exposure =
                active.stream()
                        .map(
                                ControlTowerItemResponse::
                                        monetaryExposure
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        return new ControlTowerDashboardResponse(
                new ControlTowerSummaryResponse(
                        normalizedCurrency,
                        active.size(),
                        active.stream()
                                .filter(
                                        item ->
                                                item.severity()
                                                        == ControlTowerSeverity.CRITICAL
                                )
                                .count(),
                        active.stream()
                                .filter(
                                        item ->
                                                item.severity()
                                                        == ControlTowerSeverity.HIGH
                                )
                                .count(),
                        active.stream()
                                .filter(
                                        ControlTowerItemResponse::
                                                slaOverdue
                                )
                                .count(),
                        active.stream()
                                .filter(
                                        item ->
                                                item.ownerUserId()
                                                        == null
                                )
                                .count(),
                        money(
                                exposure
                        ),
                        countType(
                                active,
                                ControlTowerExceptionType.SUPPLIER_RISK_ALERT,
                                ControlTowerExceptionType.RISK_ESCALATION_OVERDUE
                        ),
                        countType(
                                active,
                                ControlTowerExceptionType.DOCUMENT_COMPLIANCE_GAP
                        ),
                        countType(
                                active,
                                ControlTowerExceptionType.SOURCING_INITIATIVE_OVERDUE
                        ),
                        countType(
                                active,
                                ControlTowerExceptionType.BENEFIT_VALIDATION_PENDING,
                                ControlTowerExceptionType.BENEFIT_LEAKAGE,
                                ControlTowerExceptionType.COMMERCIAL_LEAKAGE
                        ),
                        countType(
                                active,
                                ControlTowerExceptionType.GOVERNANCE_DECISION_OVERDUE,
                                ControlTowerExceptionType.GOVERNANCE_ACTION_OVERDUE
                        )
                ),
                items,
                runResponse(
                        repository
                                .latestRun(
                                        normalizedCurrency
                                )
                )
        );
    }

    @Transactional(readOnly = true)
    public ControlTowerItemResponse item(
            UUID currentUserId,
            UUID itemId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    public ControlTowerItemResponse assignOwner(
            UUID currentUserId,
            UUID itemId,
            ControlTowerOwnerInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ControlTowerRepository.ItemRow item =
                requireActiveItem(
                        itemId
                );

        UUID ownerId =
                requireControlTowerUser(
                        input.ownerUserId()
                )
                        .getId();

        repository.assignOwner(
                item.id(),
                ownerId
        );

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    public ControlTowerItemResponse acknowledge(
            UUID currentUserId,
            UUID itemId,
            ControlTowerNoteInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ControlTowerRepository.ItemRow item =
                requireItem(
                        itemId
                );

        if (
                item.status()
                        != ControlTowerItemStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open control-tower items can be acknowledged."
            );
        }

        repository.acknowledge(
                itemId,
                currentUserId,
                input.note()
        );

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    public ControlTowerItemResponse start(
            UUID currentUserId,
            UUID itemId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ControlTowerRepository.ItemRow item =
                requireItem(
                        itemId
                );

        if (
                item.status()
                        != ControlTowerItemStatus.OPEN
                &&
                item.status()
                        != ControlTowerItemStatus.ACKNOWLEDGED
        ) {
            throw new IllegalArgumentException(
                    "Only open or acknowledged control-tower items can be started."
            );
        }

        repository.start(
                itemId
        );

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    public ControlTowerItemResponse resolve(
            UUID currentUserId,
            UUID itemId,
            ControlTowerNoteInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        requireActiveItem(
                itemId
        );

        repository.resolve(
                itemId,
                currentUserId,
                input.note()
        );

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    public ControlTowerItemResponse dismiss(
            UUID currentUserId,
            UUID itemId,
            ControlTowerNoteInput input
    ) {
        assertDismissRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ControlTowerRepository.ItemRow item =
                requireItem(
                        itemId
                );

        if (
                item.status()
                        == ControlTowerItemStatus.DISMISSED
        ) {
            throw new IllegalArgumentException(
                    "Control-tower item is already dismissed."
            );
        }

        repository.dismiss(
                itemId,
                currentUserId,
                input.note()
        );

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    @Transactional(readOnly = true)
    public ControlTowerContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new ControlTowerContextResponse(
                repository.users()
        );
    }

    private long countType(
            List<ControlTowerItemResponse> items,
            ControlTowerExceptionType... types
    ) {
        java.util.Set<ControlTowerExceptionType> accepted =
                java.util.Set.of(
                        types
                );

        return items.stream()
                .filter(
                        item ->
                                accepted.contains(
                                        item.exceptionType()
                                )
                )
                .count();
    }

    private ControlTowerItemResponse itemResponse(
            ControlTowerRepository.ItemRow row
    ) {
        Instant now =
                Instant.now();

        boolean active =
                row.status()
                        == ControlTowerItemStatus.OPEN
                ||
                row.status()
                        == ControlTowerItemStatus.ACKNOWLEDGED
                ||
                row.status()
                        == ControlTowerItemStatus.IN_PROGRESS;

        boolean overdue =
                active
                        &&
                        row.slaDueAt()
                                .isBefore(
                                        now
                                );

        long ageDays =
                Math.max(
                        0,
                        ChronoUnit.DAYS.between(
                                row
                                        .firstSeenAt()
                                        .atZone(
                                                ZoneOffset.UTC
                                        )
                                        .toLocalDate(),
                                now
                                        .atZone(
                                                ZoneOffset.UTC
                                        )
                                        .toLocalDate()
                        )
                );

        return new ControlTowerItemResponse(
                row.id(),
                row.exceptionKey(),
                row.exceptionType(),
                row.sourceEntityType(),
                row.sourceEntityId(),
                row.sourceReference(),
                row.currency(),
                row.title(),
                row.details(),
                row.severity(),
                decimal(
                        row.priorityScore()
                ),
                money(
                        row.monetaryExposure()
                ),
                row.sourceDueDate(),
                row.slaDueAt(),
                overdue,
                row.status(),
                row.ownerUserId(),
                row.ownerName(),
                row.acknowledgedByName(),
                row.acknowledgementNote(),
                row.acknowledgedAt(),
                row.startedAt(),
                row.resolutionNote(),
                row.resolvedByName(),
                row.resolvedAt(),
                row.firstSeenAt(),
                row.lastSeenAt(),
                ageDays,
                row.version()
        );
    }

    private ControlTowerRunResponse runResponse(
            ControlTowerRepository.RunRow row
    ) {
        if (row == null) {
            return null;
        }

        return new ControlTowerRunResponse(
                row.id(),
                row.currency(),
                row.status(),
                row.startedByName(),
                row.discoveredCount(),
                row.refreshedCount(),
                row.autoResolvedCount(),
                row.startedAt(),
                row.completedAt()
        );
    }

    private ControlTowerRepository.ItemRow requireItem(
            UUID itemId
    ) {
        ControlTowerRepository.ItemRow item =
                repository
                        .findItem(
                                itemId
                        );

        if (item == null) {
            throw new ResourceNotFoundException(
                    "Control-tower item not found: "
                            + itemId
            );
        }

        return item;
    }

    private ControlTowerRepository.ItemRow requireActiveItem(
            UUID itemId
    ) {
        ControlTowerRepository.ItemRow item =
                requireItem(
                        itemId
                );

        if (
                item.status()
                        != ControlTowerItemStatus.OPEN
                &&
                item.status()
                        != ControlTowerItemStatus.ACKNOWLEDGED
                &&
                item.status()
                        != ControlTowerItemStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Control-tower item is not active."
            );
        }

        return item;
    }

    private String normalizeCurrency(
            String currency
    ) {
        if (
                currency == null
                ||
                currency.trim()
                        .length()
                        != 3
        ) {
            throw new IllegalArgumentException(
                    "Control-tower currency must contain exactly three characters."
            );
        }

        return currency
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    private BigDecimal money(
            BigDecimal value
    ) {
        return (
                value == null
                        ? BigDecimal.ZERO
                        : value
        )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal decimal(
            BigDecimal value
    ) {
        return (
                value == null
                        ? BigDecimal.ZERO
                        : value
        )
                .setScale(
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

    private AppUserEntity requireControlTowerUser(
            UUID userId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        userId
                );

        if (
                user.getRole()
                        == ProcurementRole.REQUESTER
        ) {
            throw new IllegalArgumentException(
                    "Control-tower ownership requires a procurement governance role."
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
                    "Your ProcureIQ role cannot access the procurement control tower."
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
                &&
                role != ProcurementRole.BUYER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot manage the procurement control tower."
            );
        }
    }

    private void assertDismissRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can dismiss control-tower exceptions."
            );
        }
    }
}
