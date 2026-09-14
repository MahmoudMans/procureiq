package com.procureiq.risk;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.contract.ContractStatus;
import com.procureiq.contract.SupplierComplianceDocumentEntity;
import com.procureiq.contract.SupplierComplianceDocumentRepository;
import com.procureiq.contract.SupplierContractEntity;
import com.procureiq.contract.SupplierContractRepository;
import com.procureiq.purchaseorder.PurchaseOrderEntity;
import com.procureiq.purchaseorder.PurchaseOrderRepository;
import com.procureiq.purchaseorder.PurchaseOrderStatus;
import com.procureiq.rfq.RfqEntity;
import com.procureiq.rfq.RfqRepository;
import com.procureiq.supplier.SupplierEntity;
import com.procureiq.supplier.SupplierRepository;
import com.procureiq.supplier.SupplierRiskLevel;
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
import java.util.concurrent.atomic.AtomicLong;

@Service
@Transactional
public class ProcurementRiskService {

    private final ProcurementRiskCaseRepository
            riskRepository;

    private final RiskMitigationActionRepository
            mitigationRepository;

    private final RiskScoringService
            scoringService;

    private final AppUserRepository
            appUserRepository;

    private final SupplierRepository
            supplierRepository;

    private final SupplierContractRepository
            contractRepository;

    private final SupplierComplianceDocumentRepository
            complianceDocumentRepository;

    private final PurchaseOrderRepository
            purchaseOrderRepository;

    private final RfqRepository
            rfqRepository;

    public ProcurementRiskService(
            ProcurementRiskCaseRepository riskRepository,
            RiskMitigationActionRepository mitigationRepository,
            RiskScoringService scoringService,
            AppUserRepository appUserRepository,
            SupplierRepository supplierRepository,
            SupplierContractRepository contractRepository,
            SupplierComplianceDocumentRepository complianceDocumentRepository,
            PurchaseOrderRepository purchaseOrderRepository,
            RfqRepository rfqRepository
    ) {
        this.riskRepository =
                riskRepository;

        this.mitigationRepository =
                mitigationRepository;

        this.scoringService =
                scoringService;

        this.appUserRepository =
                appUserRepository;

        this.supplierRepository =
                supplierRepository;

        this.contractRepository =
                contractRepository;

        this.complianceDocumentRepository =
                complianceDocumentRepository;

        this.purchaseOrderRepository =
                purchaseOrderRepository;

        this.rfqRepository =
                rfqRepository;
    }

    @Transactional(readOnly = true)
    public List<RiskCaseResponse> findCases(
            UUID currentUserId,
            String query,
            RiskCaseStatus status,
            RiskSeverity severity,
            RiskCategory category
    ) {
        findCurrentUser(
                currentUserId
        );

        String normalizedQuery =
                normalizeOptional(
                        query
                );

        return riskRepository
                .findAllByOrderByUpdatedAtDesc()
                .stream()
                .filter(
                        risk ->
                                status == null
                                ||
                                risk.getStatus()
                                        == status
                )
                .filter(
                        risk ->
                                severity == null
                                ||
                                risk.getSeverity()
                                        == severity
                )
                .filter(
                        risk ->
                                category == null
                                ||
                                risk.getCategory()
                                        == category
                )
                .filter(
                        risk ->
                                matchesQuery(
                                        risk,
                                        normalizedQuery
                                )
                )
                .map(
                        this::toResponse
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public RiskCaseResponse findCase(
            UUID currentUserId,
            UUID riskId
    ) {
        findCurrentUser(
                currentUserId
        );

        return toResponse(
                findRisk(
                        riskId
                )
        );
    }

    public RiskCaseResponse createCase(
            UUID currentUserId,
            RiskCaseCreateInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        ProcurementRiskCaseEntity risk =
                new ProcurementRiskCaseEntity();

        risk.setRiskNumber(
                nextRiskNumber()
        );

        risk.setOrigin(
                RiskOrigin.MANUAL
        );

        risk.setStatus(
                RiskCaseStatus.OPEN
        );

        applyRiskFields(
                risk,
                input.title(),
                input.description(),
                input.category(),
                input.likelihood(),
                input.impact(),
                input.dueDate()
        );

        RelatedEntities related =
                resolveRelatedEntities(
                        input.supplierId(),
                        input.contractId(),
                        input.purchaseOrderId(),
                        input.rfqId()
                );

        applyRelatedEntities(
                risk,
                related
        );

        risk.setOwner(
                input.ownerUserId() == null
                        ? currentUser
                        : findAssignableUser(
                                input.ownerUserId()
                        )
        );

        risk.setCreatedBy(
                currentUser
        );

        return toResponse(
                riskRepository
                        .save(risk)
        );
    }

    public RiskCaseResponse updateCase(
            UUID currentUserId,
            UUID riskId,
            RiskCaseUpdateInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        ProcurementRiskCaseEntity risk =
                findRisk(
                        riskId
                );

        assertOpenRisk(
                risk
        );

        applyRiskFields(
                risk,
                input.title(),
                input.description(),
                input.category(),
                input.likelihood(),
                input.impact(),
                input.dueDate()
        );

        if (
                input.ownerUserId()
                        != null
        ) {
            risk.setOwner(
                    findAssignableUser(
                            input.ownerUserId()
                    )
            );
        }

        return toResponse(
                riskRepository
                        .save(risk)
        );
    }

    public RiskCaseResponse startMitigation(
            UUID currentUserId,
            UUID riskId
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        ProcurementRiskCaseEntity risk =
                findRisk(
                        riskId
                );

        if (
                risk.getStatus()
                        != RiskCaseStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open risks can enter mitigation."
            );
        }

        risk.setStatus(
                RiskCaseStatus.IN_MITIGATION
        );

        return toResponse(
                riskRepository
                        .save(risk)
        );
    }

    public RiskCaseResponse escalate(
            UUID currentUserId,
            UUID riskId
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertManagerRole(
                currentUser.getRole()
        );

        ProcurementRiskCaseEntity risk =
                findRisk(
                        riskId
                );

        assertOpenRisk(
                risk
        );

        if (risk.isEscalated()) {
            throw new IllegalArgumentException(
                    "Risk case is already escalated."
            );
        }

        risk.setEscalated(true);

        risk.setEscalatedAt(
                Instant.now()
        );

        risk.setEscalatedBy(
                currentUser
        );

        return toResponse(
                riskRepository
                        .save(risk)
        );
    }

    public RiskCaseResponse resolve(
            UUID currentUserId,
            UUID riskId,
            RiskResolutionInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertManagerRole(
                currentUser.getRole()
        );

        ProcurementRiskCaseEntity risk =
                findRisk(
                        riskId
                );

        assertOpenRisk(
                risk
        );

        long openActions =
                risk.getMitigationActions()
                        .stream()
                        .filter(
                                action ->
                                        action.getStatus()
                                                == MitigationActionStatus.OPEN
                        )
                        .count();

        if (openActions > 0) {
            throw new IllegalArgumentException(
                    "Complete or cancel all mitigation actions before resolving the risk."
            );
        }

        risk.setStatus(
                RiskCaseStatus.RESOLVED
        );

        risk.setResolutionNote(
                normalizeRequired(
                        input.note()
                )
        );

        risk.setResolvedAt(
                Instant.now()
        );

        risk.setResolvedBy(
                currentUser
        );

        return toResponse(
                riskRepository
                        .save(risk)
        );
    }

    public RiskCaseResponse accept(
            UUID currentUserId,
            UUID riskId,
            RiskResolutionInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertManagerRole(
                currentUser.getRole()
        );

        ProcurementRiskCaseEntity risk =
                findRisk(
                        riskId
                );

        assertOpenRisk(
                risk
        );

        risk.setStatus(
                RiskCaseStatus.ACCEPTED
        );

        risk.setResolutionNote(
                normalizeRequired(
                        input.note()
                )
        );

        risk.setResolvedAt(
                Instant.now()
        );

        risk.setResolvedBy(
                currentUser
        );

        return toResponse(
                riskRepository
                        .save(risk)
        );
    }

    public RiskMitigationActionResponse
    addMitigationAction(
            UUID currentUserId,
            UUID riskId,
            RiskMitigationActionInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        ProcurementRiskCaseEntity risk =
                findRisk(
                        riskId
                );

        assertOpenRisk(
                risk
        );

        RiskMitigationActionEntity action =
                new RiskMitigationActionEntity();

        action.setRiskCase(
                risk
        );

        action.setTitle(
                normalizeRequired(
                        input.title()
                )
        );

        action.setDescription(
                normalizeOptional(
                        input.description()
                )
        );

        action.setStatus(
                MitigationActionStatus.OPEN
        );

        action.setDueDate(
                input.dueDate()
        );

        action.setOwner(
                input.ownerUserId() == null
                        ? currentUser
                        : findAssignableUser(
                                input.ownerUserId()
                        )
        );

        action.setCreatedBy(
                currentUser
        );

        if (
                risk.getStatus()
                        == RiskCaseStatus.OPEN
        ) {
            risk.setStatus(
                    RiskCaseStatus.IN_MITIGATION
            );

            riskRepository.save(
                    risk
            );
        }

        return toActionResponse(
                mitigationRepository
                        .save(action)
        );
    }

    public RiskMitigationActionResponse
    completeMitigationAction(
            UUID currentUserId,
            UUID actionId
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        RiskMitigationActionEntity action =
                mitigationRepository
                        .findById(
                                actionId
                        )
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Mitigation action not found: "
                                                        + actionId
                                        )
                        );

        if (
                action.getStatus()
                        != MitigationActionStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open mitigation actions can be completed."
            );
        }

        action.setStatus(
                MitigationActionStatus.COMPLETED
        );

        action.setCompletedAt(
                Instant.now()
        );

        action.setCompletedBy(
                currentUser
        );

        return toActionResponse(
                mitigationRepository
                        .save(action)
        );
    }

    @Transactional(readOnly = true)
    public RiskSummaryResponse summary(
            UUID currentUserId
    ) {
        findCurrentUser(
                currentUserId
        );

        List<ProcurementRiskCaseEntity> cases =
                riskRepository
                        .findAll();

        long open =
                cases.stream()
                        .filter(
                                this::isOpenState
                        )
                        .count();

        long critical =
                cases.stream()
                        .filter(
                                this::isOpenState
                        )
                        .filter(
                                risk ->
                                        risk.getSeverity()
                                                == RiskSeverity.CRITICAL
                        )
                        .count();

        long high =
                cases.stream()
                        .filter(
                                this::isOpenState
                        )
                        .filter(
                                risk ->
                                        risk.getSeverity()
                                                == RiskSeverity.HIGH
                        )
                        .count();

        long overdue =
                cases.stream()
                        .filter(
                                this::isOpenState
                        )
                        .filter(
                                this::isOverdue
                        )
                        .count();

        long escalated =
                cases.stream()
                        .filter(
                                this::isOpenState
                        )
                        .filter(
                                ProcurementRiskCaseEntity::
                                        isEscalated
                        )
                        .count();

        long resolved =
                cases.stream()
                        .filter(
                                risk ->
                                        risk.getStatus()
                                                == RiskCaseStatus.RESOLVED
                        )
                        .count();

        BigDecimal average =
                cases.stream()
                        .filter(
                                this::isOpenState
                        )
                        .mapToInt(
                                ProcurementRiskCaseEntity::
                                        getRiskScore
                        )
                        .average()
                        .stream()
                        .mapToObj(
                                value ->
                                        BigDecimal.valueOf(
                                                value
                                        )
                                                .setScale(
                                                        2,
                                                        RoundingMode.HALF_UP
                                                )
                        )
                        .findFirst()
                        .orElse(
                                BigDecimal.ZERO
                                        .setScale(2)
                        );

        return new RiskSummaryResponse(
                cases.size(),
                open,
                critical,
                high,
                overdue,
                escalated,
                resolved,
                average
        );
    }

    @Transactional(readOnly = true)
    public RiskContextOptionsResponse contextOptions(
            UUID currentUserId
    ) {
        findCurrentUser(
                currentUserId
        );

        List<RiskUserOptionResponse> users =
                appUserRepository
                        .findAll()
                        .stream()
                        .filter(
                                AppUserEntity::isActive
                        )
                        .sorted(
                                Comparator.comparing(
                                        AppUserEntity::getFullName,
                                        String.CASE_INSENSITIVE_ORDER
                                )
                        )
                        .map(
                                user ->
                                        new RiskUserOptionResponse(
                                                user.getId(),
                                                user.getFullName(),
                                                user.getRole()
                                        )
                        )
                        .toList();

        List<RiskSupplierOptionResponse> suppliers =
                supplierRepository
                        .findAll()
                        .stream()
                        .sorted(
                                Comparator.comparing(
                                        SupplierEntity::getLegalName,
                                        String.CASE_INSENSITIVE_ORDER
                                )
                        )
                        .map(
                                supplier ->
                                        new RiskSupplierOptionResponse(
                                                supplier.getId(),
                                                supplier.getSupplierCode(),
                                                supplier.getLegalName()
                                        )
                        )
                        .toList();

        List<RiskContractOptionResponse> contracts =
                contractRepository
                        .findAll()
                        .stream()
                        .sorted(
                                Comparator.comparing(
                                        SupplierContractEntity::
                                                getUpdatedAt
                                )
                                        .reversed()
                        )
                        .map(
                                contract ->
                                        new RiskContractOptionResponse(
                                                contract.getId(),
                                                contract.getContractNumber(),
                                                contract.getTitle(),
                                                contract.getSupplier()
                                                        .getId(),
                                                contract.getSupplier()
                                                        .getLegalName()
                                        )
                        )
                        .toList();

        List<RiskPurchaseOrderOptionResponse> purchaseOrders =
                purchaseOrderRepository
                        .findAll()
                        .stream()
                        .sorted(
                                Comparator.comparing(
                                        PurchaseOrderEntity::
                                                getUpdatedAt
                                )
                                        .reversed()
                        )
                        .map(
                                order ->
                                        new RiskPurchaseOrderOptionResponse(
                                                order.getId(),
                                                order.getPoNumber(),
                                                order.getSupplier()
                                                        .getId(),
                                                order.getSupplier()
                                                        .getLegalName(),
                                                order.getStatus()
                                                        .name()
                                        )
                        )
                        .toList();

        List<RiskRfqOptionResponse> rfqs =
                rfqRepository
                        .findAll()
                        .stream()
                        .sorted(
                                Comparator.comparing(
                                        RfqEntity::getUpdatedAt
                                )
                                        .reversed()
                        )
                        .map(
                                rfq ->
                                        new RiskRfqOptionResponse(
                                                rfq.getId(),
                                                rfq.getRfqNumber(),
                                                rfq.getTitle(),
                                                rfq.getStatus()
                                                        .name()
                                        )
                        )
                        .toList();

        return new RiskContextOptionsResponse(
                users,
                suppliers,
                contracts,
                purchaseOrders,
                rfqs
        );
    }

    public SystemRiskRefreshResponse refreshSystemExceptions(
            UUID currentUserId
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        AtomicLong discovered =
                new AtomicLong();

        AtomicLong created =
                new AtomicLong();

        AtomicLong updated =
                new AtomicLong();

        AtomicLong reopened =
                new AtomicLong();

        LocalDate today =
                today();

        for (
                SupplierEntity supplier
                : supplierRepository.findAll()
        ) {
            if (
                    supplier.getRiskLevel()
                            == SupplierRiskLevel.HIGH
                    ||
                    supplier.getRiskLevel()
                            == SupplierRiskLevel.CRITICAL
            ) {
                discovered.incrementAndGet();

                int likelihood =
                        supplier.getRiskLevel()
                                == SupplierRiskLevel.CRITICAL
                                ? 4
                                : 3;

                int impact =
                        supplier.getRiskLevel()
                                == SupplierRiskLevel.CRITICAL
                                ? 5
                                : 4;

                UpsertResult result =
                        upsertSystemRisk(
                                "SUPPLIER_RISK:"
                                        + supplier.getId(),
                                RiskCategory.SUPPLIER,
                                "Elevated supplier risk: "
                                        + supplier.getLegalName(),
                                "Supplier master data currently classifies "
                                        + supplier.getLegalName()
                                        + " as "
                                        + supplier.getRiskLevel()
                                        + " risk.",
                                likelihood,
                                impact,
                                today.plusDays(30),
                                supplier,
                                null,
                                null,
                                null,
                                currentUser
                        );

                incrementResult(
                        result,
                        created,
                        updated,
                        reopened
                );
            }
        }

        for (
                SupplierContractEntity contract
                : contractRepository.findAll()
        ) {
            if (
                    contract.getStatus()
                            != ContractStatus.TERMINATED
                    &&
                    contract.getEndDate()
                            .isBefore(today)
            ) {
                discovered.incrementAndGet();

                UpsertResult result =
                        upsertSystemRisk(
                                "CONTRACT_EXPIRED:"
                                        + contract.getId(),
                                RiskCategory.CONTRACT,
                                "Expired supplier contract: "
                                        + contract.getContractNumber(),
                                contract.getTitle()
                                        + " for "
                                        + contract.getSupplier()
                                                .getLegalName()
                                        + " is expired and requires renewal, replacement or closure.",
                                4,
                                4,
                                today.plusDays(7),
                                contract.getSupplier(),
                                contract,
                                null,
                                null,
                                currentUser
                        );

                incrementResult(
                        result,
                        created,
                        updated,
                        reopened
                );
            }
        }

        for (
                SupplierComplianceDocumentEntity document
                : complianceDocumentRepository
                        .findAll()
        ) {
            if (
                    document.isRequired()
                    &&
                    document.getExpiryDate()
                            != null
                    &&
                    document.getExpiryDate()
                            .isBefore(today)
            ) {
                discovered.incrementAndGet();

                UpsertResult result =
                        upsertSystemRisk(
                                "COMPLIANCE_EXPIRED:"
                                        + document.getId(),
                                RiskCategory.COMPLIANCE,
                                "Expired required compliance document",
                                document.getDocumentName()
                                        + " for "
                                        + document.getSupplier()
                                                .getLegalName()
                                        + " expired on "
                                        + document.getExpiryDate()
                                        + ".",
                                4,
                                5,
                                today.plusDays(7),
                                document.getSupplier(),
                                document.getContract(),
                                null,
                                null,
                                currentUser
                        );

                incrementResult(
                        result,
                        created,
                        updated,
                        reopened
                );
            }
        }

        for (
                PurchaseOrderEntity order
                : purchaseOrderRepository
                        .findAll()
        ) {
            if (
                    (
                            order.getStatus()
                                    == PurchaseOrderStatus.ISSUED
                            ||
                            order.getStatus()
                                    == PurchaseOrderStatus.PARTIALLY_RECEIVED
                    )
                    &&
                    order.getExpectedDeliveryDate()
                            .isBefore(today)
            ) {
                discovered.incrementAndGet();

                UpsertResult result =
                        upsertSystemRisk(
                                "PO_OVERDUE:"
                                        + order.getId(),
                                RiskCategory.DELIVERY,
                                "Overdue delivery: "
                                        + order.getPoNumber(),
                                "Purchase order "
                                        + order.getPoNumber()
                                        + " for "
                                        + order.getSupplier()
                                                .getLegalName()
                                        + " is past its expected delivery date.",
                                4,
                                4,
                                order.getExpectedDeliveryDate(),
                                order.getSupplier(),
                                null,
                                order,
                                order.getRfq(),
                                currentUser
                        );

                incrementResult(
                        result,
                        created,
                        updated,
                        reopened
                );
            }
        }

        return new SystemRiskRefreshResponse(
                discovered.get(),
                created.get(),
                updated.get(),
                reopened.get()
        );
    }

    private UpsertResult upsertSystemRisk(
            String sourceKey,
            RiskCategory category,
            String title,
            String description,
            int likelihood,
            int impact,
            LocalDate dueDate,
            SupplierEntity supplier,
            SupplierContractEntity contract,
            PurchaseOrderEntity purchaseOrder,
            RfqEntity rfq,
            AppUserEntity currentUser
    ) {
        ProcurementRiskCaseEntity risk =
                riskRepository
                        .findBySourceKey(
                                sourceKey
                        )
                        .orElse(null);

        boolean created =
                risk == null;

        boolean reopened =
                false;

        if (risk == null) {
            risk =
                    new ProcurementRiskCaseEntity();

            risk.setRiskNumber(
                    nextRiskNumber()
            );

            risk.setSourceKey(
                    sourceKey
            );

            risk.setOrigin(
                    RiskOrigin.SYSTEM
            );

            risk.setStatus(
                    RiskCaseStatus.OPEN
            );

            risk.setOwner(
                    currentUser
            );

            risk.setCreatedBy(
                    currentUser
            );
        } else if (
                risk.getStatus()
                        == RiskCaseStatus.RESOLVED
        ) {
            risk.setStatus(
                    RiskCaseStatus.OPEN
            );

            risk.setResolutionNote(
                    null
            );

            risk.setResolvedAt(
                    null
            );

            risk.setResolvedBy(
                    null
            );

            reopened = true;
        }

        applyRiskFields(
                risk,
                title,
                description,
                category,
                likelihood,
                impact,
                dueDate
        );

        risk.setSupplier(
                supplier
        );

        risk.setContract(
                contract
        );

        risk.setPurchaseOrder(
                purchaseOrder
        );

        risk.setRfq(
                rfq
        );

        riskRepository.save(
                risk
        );

        if (created) {
            return UpsertResult.CREATED;
        }

        if (reopened) {
            return UpsertResult.REOPENED;
        }

        return UpsertResult.UPDATED;
    }

    private void incrementResult(
            UpsertResult result,
            AtomicLong created,
            AtomicLong updated,
            AtomicLong reopened
    ) {
        switch (result) {
            case CREATED ->
                    created.incrementAndGet();

            case UPDATED ->
                    updated.incrementAndGet();

            case REOPENED ->
                    reopened.incrementAndGet();
        }
    }

    private void applyRiskFields(
            ProcurementRiskCaseEntity risk,
            String title,
            String description,
            RiskCategory category,
            int likelihood,
            int impact,
            LocalDate dueDate
    ) {
        int score =
                scoringService.score(
                        likelihood,
                        impact
                );

        risk.setTitle(
                normalizeRequired(
                        title
                )
        );

        risk.setDescription(
                normalizeRequired(
                        description
                )
        );

        risk.setCategory(
                category
        );

        risk.setLikelihood(
                likelihood
        );

        risk.setImpact(
                impact
        );

        risk.setRiskScore(
                score
        );

        risk.setSeverity(
                scoringService
                        .severity(
                                score
                        )
        );

        risk.setDueDate(
                dueDate
        );
    }

    private RelatedEntities resolveRelatedEntities(
            UUID supplierId,
            UUID contractId,
            UUID purchaseOrderId,
            UUID rfqId
    ) {
        SupplierEntity supplier =
                supplierId == null
                        ? null
                        : supplierRepository
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

        SupplierContractEntity contract =
                contractId == null
                        ? null
                        : contractRepository
                                .findById(
                                        contractId
                                )
                                .orElseThrow(
                                        () ->
                                                new ResourceNotFoundException(
                                                        "Contract not found: "
                                                                + contractId
                                                )
                                );

        PurchaseOrderEntity purchaseOrder =
                purchaseOrderId == null
                        ? null
                        : purchaseOrderRepository
                                .findById(
                                        purchaseOrderId
                                )
                                .orElseThrow(
                                        () ->
                                                new ResourceNotFoundException(
                                                        "Purchase order not found: "
                                                                + purchaseOrderId
                                                )
                                );

        RfqEntity rfq =
                rfqId == null
                        ? null
                        : rfqRepository
                                .findById(
                                        rfqId
                                )
                                .orElseThrow(
                                        () ->
                                                new ResourceNotFoundException(
                                                        "RFQ not found: "
                                                                + rfqId
                                                )
                                );

        if (
                contract != null
                &&
                supplier != null
                &&
                !contract.getSupplier()
                        .getId()
                        .equals(
                                supplier.getId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Selected contract does not belong to the selected supplier."
            );
        }

        if (
                purchaseOrder != null
                &&
                supplier != null
                &&
                !purchaseOrder.getSupplier()
                        .getId()
                        .equals(
                                supplier.getId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Selected purchase order does not belong to the selected supplier."
            );
        }

        if (
                supplier == null
                &&
                contract != null
        ) {
            supplier =
                    contract.getSupplier();
        }

        if (
                supplier == null
                &&
                purchaseOrder != null
        ) {
            supplier =
                    purchaseOrder.getSupplier();
        }

        if (
                rfq == null
                &&
                purchaseOrder != null
        ) {
            rfq =
                    purchaseOrder.getRfq();
        }

        return new RelatedEntities(
                supplier,
                contract,
                purchaseOrder,
                rfq
        );
    }

    private void applyRelatedEntities(
            ProcurementRiskCaseEntity risk,
            RelatedEntities related
    ) {
        risk.setSupplier(
                related.supplier()
        );

        risk.setContract(
                related.contract()
        );

        risk.setPurchaseOrder(
                related.purchaseOrder()
        );

        risk.setRfq(
                related.rfq()
        );
    }

    private RiskCaseResponse toResponse(
            ProcurementRiskCaseEntity risk
    ) {
        SupplierEntity supplier =
                risk.getSupplier();

        SupplierContractEntity contract =
                risk.getContract();

        PurchaseOrderEntity purchaseOrder =
                risk.getPurchaseOrder();

        RfqEntity rfq =
                risk.getRfq();

        long openActions =
                risk.getMitigationActions()
                        .stream()
                        .filter(
                                action ->
                                        action.getStatus()
                                                == MitigationActionStatus.OPEN
                        )
                        .count();

        long completedActions =
                risk.getMitigationActions()
                        .stream()
                        .filter(
                                action ->
                                        action.getStatus()
                                                == MitigationActionStatus.COMPLETED
                        )
                        .count();

        return new RiskCaseResponse(
                risk.getId(),
                risk.getRiskNumber(),
                risk.getOrigin(),
                risk.getCategory(),
                risk.getSeverity(),
                risk.getStatus(),
                risk.getTitle(),
                risk.getDescription(),
                risk.getLikelihood(),
                risk.getImpact(),
                risk.getRiskScore(),
                risk.getDueDate(),
                isOverdue(risk),

                supplier == null
                        ? null
                        : supplier.getId(),

                supplier == null
                        ? null
                        : supplier.getLegalName(),

                contract == null
                        ? null
                        : contract.getId(),

                contract == null
                        ? null
                        : contract.getContractNumber(),

                purchaseOrder == null
                        ? null
                        : purchaseOrder.getId(),

                purchaseOrder == null
                        ? null
                        : purchaseOrder.getPoNumber(),

                rfq == null
                        ? null
                        : rfq.getId(),

                rfq == null
                        ? null
                        : rfq.getRfqNumber(),

                risk.getOwner()
                        .getId(),

                risk.getOwner()
                        .getFullName(),

                risk.getCreatedBy()
                        .getId(),

                risk.getCreatedBy()
                        .getFullName(),

                risk.isEscalated(),
                risk.getEscalatedAt(),

                risk.getEscalatedBy() == null
                        ? null
                        : risk.getEscalatedBy()
                                .getFullName(),

                risk.getResolutionNote(),
                risk.getResolvedAt(),

                risk.getResolvedBy() == null
                        ? null
                        : risk.getResolvedBy()
                                .getFullName(),

                openActions,
                completedActions,

                risk.getMitigationActions()
                        .stream()
                        .sorted(
                                Comparator.comparing(
                                        RiskMitigationActionEntity::
                                                getCreatedAt
                                )
                                        .reversed()
                        )
                        .map(
                                this::toActionResponse
                        )
                        .toList(),

                risk.getCreatedAt(),
                risk.getUpdatedAt(),
                risk.getVersion()
        );
    }

    private RiskMitigationActionResponse toActionResponse(
            RiskMitigationActionEntity action
    ) {
        return new RiskMitigationActionResponse(
                action.getId(),
                action.getTitle(),
                action.getDescription(),
                action.getStatus(),
                action.getDueDate(),
                action.getStatus()
                        == MitigationActionStatus.OPEN
                        &&
                        action.getDueDate()
                                != null
                        &&
                        action.getDueDate()
                                .isBefore(
                                        today()
                                ),
                action.getOwner()
                        .getId(),
                action.getOwner()
                        .getFullName(),
                action.getCompletedAt(),
                action.getCompletedBy() == null
                        ? null
                        : action.getCompletedBy()
                                .getFullName(),
                action.getCreatedAt(),
                action.getUpdatedAt()
        );
    }

    private boolean matchesQuery(
            ProcurementRiskCaseEntity risk,
            String query
    ) {
        if (query == null) {
            return true;
        }

        String lower =
                query.toLowerCase(
                        Locale.ROOT
                );

        return contains(
                risk.getRiskNumber(),
                lower
        )
                ||
                contains(
                        risk.getTitle(),
                        lower
                )
                ||
                contains(
                        risk.getDescription(),
                        lower
                )
                ||
                (
                        risk.getSupplier()
                                != null
                        &&
                        contains(
                                risk.getSupplier()
                                        .getLegalName(),
                                lower
                        )
                );
    }

    private boolean contains(
            String value,
            String query
    ) {
        return value != null
                &&
                value.toLowerCase(
                        Locale.ROOT
                )
                        .contains(query);
    }

    private boolean isOpenState(
            ProcurementRiskCaseEntity risk
    ) {
        return risk.getStatus()
                == RiskCaseStatus.OPEN
                ||
                risk.getStatus()
                        == RiskCaseStatus.IN_MITIGATION;
    }

    private boolean isOverdue(
            ProcurementRiskCaseEntity risk
    ) {
        return isOpenState(risk)
                &&
                risk.getDueDate()
                        != null
                &&
                risk.getDueDate()
                        .isBefore(
                                today()
                        );
    }

    private void assertOpenRisk(
            ProcurementRiskCaseEntity risk
    ) {
        if (!isOpenState(risk)) {
            throw new IllegalArgumentException(
                    "Closed risk cases cannot be modified."
            );
        }
    }

    private ProcurementRiskCaseEntity findRisk(
            UUID riskId
    ) {
        return riskRepository
                .findById(
                        riskId
                )
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Risk case not found: "
                                                + riskId
                                )
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
                                                "Risk owner not found: "
                                                        + userId
                                        )
                        );

        if (!user.isActive()) {
            throw new IllegalArgumentException(
                    "Risk owner must be an active ProcureIQ user."
            );
        }

        return user;
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
                    "Your ProcureIQ role cannot manage risk cases."
            );
        }
    }

    private void assertManagerRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can escalate, resolve or accept risks."
            );
        }
    }

    private String nextRiskNumber() {
        Long sequence =
                riskRepository
                        .nextRiskSequence();

        int year =
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue();

        return String.format(
                "RSK-%d-%05d",
                year,
                sequence
        );
    }

    private LocalDate today() {
        return LocalDate.now(
                ZoneOffset.UTC
        );
    }

    private String normalizeRequired(
            String value
    ) {
        return value.trim();
    }

    private String normalizeOptional(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String normalized =
                value.trim();

        return normalized.isEmpty()
                ? null
                : normalized;
    }

    private record RelatedEntities(
            SupplierEntity supplier,
            SupplierContractEntity contract,
            PurchaseOrderEntity purchaseOrder,
            RfqEntity rfq
    ) {
    }

    private enum UpsertResult {
        CREATED,
        UPDATED,
        REOPENED
    }
}
