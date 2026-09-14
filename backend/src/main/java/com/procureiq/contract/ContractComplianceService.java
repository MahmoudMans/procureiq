package com.procureiq.contract;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.supplier.SupplierEntity;
import com.procureiq.supplier.SupplierRepository;
import com.procureiq.supplier.SupplierStatus;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class ContractComplianceService {

    private static final int EXPIRING_SOON_DAYS =
            30;

    private final SupplierContractRepository
            contractRepository;

    private final SupplierComplianceDocumentRepository
            documentRepository;

    private final SupplierRepository
            supplierRepository;

    private final AppUserRepository
            appUserRepository;

    private final ContractComplianceCalculator
            calculator;

    public ContractComplianceService(
            SupplierContractRepository contractRepository,
            SupplierComplianceDocumentRepository documentRepository,
            SupplierRepository supplierRepository,
            AppUserRepository appUserRepository,
            ContractComplianceCalculator calculator
    ) {
        this.contractRepository =
                contractRepository;

        this.documentRepository =
                documentRepository;

        this.supplierRepository =
                supplierRepository;

        this.appUserRepository =
                appUserRepository;

        this.calculator =
                calculator;
    }

    @Transactional(readOnly = true)
    public List<ContractSupplierOptionResponse>
    supplierOptions(
            UUID currentUserId
    ) {
        findCurrentUser(
                currentUserId
        );

        return supplierRepository
                .findAll()
                .stream()
                .filter(
                        supplier ->
                                supplier.getStatus()
                                        == SupplierStatus.ACTIVE
                )
                .sorted(
                        Comparator.comparing(
                                SupplierEntity::getLegalName,
                                String.CASE_INSENSITIVE_ORDER
                        )
                )
                .map(
                        supplier ->
                                new ContractSupplierOptionResponse(
                                        supplier.getId(),
                                        supplier.getSupplierCode(),
                                        supplier.getLegalName()
                                )
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ContractResponse> findContracts(
            UUID currentUserId,
            String query,
            ContractStatus status,
            UUID supplierId
    ) {
        findCurrentUser(
                currentUserId
        );

        return contractRepository
                .search(
                        normalizeOptional(query),
                        status,
                        supplierId
                )
                .stream()
                .map(
                        this::toContractResponse
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public ContractResponse findContract(
            UUID currentUserId,
            UUID contractId
    ) {
        findCurrentUser(
                currentUserId
        );

        return toContractResponse(
                findContractEntity(
                        contractId
                )
        );
    }

    public ContractResponse createContract(
            UUID currentUserId,
            ContractCreateInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                user.getRole()
        );

        SupplierEntity supplier =
                findSupplier(
                        input.supplierId()
                );

        validateContractDates(
                input.startDate(),
                input.endDate()
        );

        SupplierContractEntity contract =
                new SupplierContractEntity();

        contract.setContractNumber(
                nextContractNumber()
        );

        contract.setSupplier(
                supplier
        );

        contract.setTitle(
                normalizeRequired(
                        input.title()
                )
        );

        contract.setContractType(
                normalizeRequired(
                        input.contractType()
                )
        );

        contract.setStatus(
                ContractStatus.DRAFT
        );

        contract.setStartDate(
                input.startDate()
        );

        contract.setEndDate(
                input.endDate()
        );

        contract.setCurrency(
                input.currency()
                        .trim()
                        .toUpperCase(
                                Locale.ROOT
                        )
        );

        contract.setContractValue(
                money(
                        input.contractValue()
                )
        );

        contract.setAutoRenew(
                input.autoRenew()
        );

        contract.setNoticePeriodDays(
                input.noticePeriodDays()
        );

        contract.setOwner(
                user
        );

        contract.setNotes(
                normalizeOptional(
                        input.notes()
                )
        );

        return toContractResponse(
                contractRepository
                        .save(contract)
        );
    }

    public ContractResponse updateContract(
            UUID currentUserId,
            UUID contractId,
            ContractUpdateInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                user.getRole()
        );

        SupplierContractEntity contract =
                findContractEntity(
                        contractId
                );

        if (
                contract.getStatus()
                        == ContractStatus.TERMINATED
        ) {
            throw new IllegalArgumentException(
                    "Terminated contracts cannot be edited."
            );
        }

        validateContractDates(
                input.startDate(),
                input.endDate()
        );

        contract.setTitle(
                normalizeRequired(
                        input.title()
                )
        );

        contract.setContractType(
                normalizeRequired(
                        input.contractType()
                )
        );

        contract.setStartDate(
                input.startDate()
        );

        contract.setEndDate(
                input.endDate()
        );

        contract.setCurrency(
                input.currency()
                        .trim()
                        .toUpperCase(
                                Locale.ROOT
                        )
        );

        contract.setContractValue(
                money(
                        input.contractValue()
                )
        );

        contract.setAutoRenew(
                input.autoRenew()
        );

        contract.setNoticePeriodDays(
                input.noticePeriodDays()
        );

        contract.setNotes(
                normalizeOptional(
                        input.notes()
                )
        );

        if (
                contract.getStatus()
                        == ContractStatus.EXPIRED
                &&
                !contract.getEndDate()
                        .isBefore(
                                today()
                        )
        ) {
            contract.setStatus(
                    ContractStatus.ACTIVE
            );
        }

        return toContractResponse(
                contractRepository
                        .save(contract)
        );
    }

    public ContractResponse activateContract(
            UUID currentUserId,
            UUID contractId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                user.getRole()
        );

        SupplierContractEntity contract =
                findContractEntity(
                        contractId
                );

        if (
                contract.getStatus()
                        != ContractStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft contracts can be activated."
            );
        }

        if (
                contract.getEndDate()
                        .isBefore(
                                today()
                        )
        ) {
            throw new IllegalArgumentException(
                    "An already expired contract cannot be activated."
            );
        }

        contract.setStatus(
                ContractStatus.ACTIVE
        );

        return toContractResponse(
                contractRepository
                        .save(contract)
        );
    }

    public ContractResponse terminateContract(
            UUID currentUserId,
            UUID contractId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertManagerRole(
                user.getRole()
        );

        SupplierContractEntity contract =
                findContractEntity(
                        contractId
                );

        if (
                contract.getStatus()
                        == ContractStatus.TERMINATED
        ) {
            throw new IllegalArgumentException(
                    "Contract is already terminated."
            );
        }

        contract.setStatus(
                ContractStatus.TERMINATED
        );

        return toContractResponse(
                contractRepository
                        .save(contract)
        );
    }

    public ComplianceDocumentResponse
    createComplianceDocument(
            UUID currentUserId,
            UUID supplierId,
            ComplianceDocumentInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                user.getRole()
        );

        SupplierEntity supplier =
                findSupplier(
                        supplierId
                );

        SupplierContractEntity contract =
                resolveContract(
                        supplierId,
                        input.contractId()
                );

        validateDocumentDates(
                input.issueDate(),
                input.expiryDate()
        );

        SupplierComplianceDocumentEntity document =
                new SupplierComplianceDocumentEntity();

        document.setSupplier(
                supplier
        );

        document.setContract(
                contract
        );

        applyDocumentInput(
                document,
                input
        );

        document.setCreatedBy(
                user
        );

        return toDocumentResponse(
                documentRepository
                        .save(document)
        );
    }

    public ComplianceDocumentResponse
    updateComplianceDocument(
            UUID currentUserId,
            UUID documentId,
            ComplianceDocumentInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                user.getRole()
        );

        SupplierComplianceDocumentEntity document =
                documentRepository
                        .findById(
                                documentId
                        )
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Compliance document not found: "
                                                        + documentId
                                        )
                        );

        SupplierContractEntity contract =
                resolveContract(
                        document.getSupplier()
                                .getId(),
                        input.contractId()
                );

        validateDocumentDates(
                input.issueDate(),
                input.expiryDate()
        );

        document.setContract(
                contract
        );

        applyDocumentInput(
                document,
                input
        );

        return toDocumentResponse(
                documentRepository
                        .save(document)
        );
    }

    @Transactional(readOnly = true)
    public SupplierComplianceResponse
    supplierCompliance(
            UUID currentUserId,
            UUID supplierId
    ) {
        findCurrentUser(
                currentUserId
        );

        SupplierEntity supplier =
                findSupplier(
                        supplierId
                );

        List<ComplianceDocumentResponse> documents =
                documentRepository
                        .findAllBySupplier_IdOrderByExpiryDateAsc(
                                supplierId
                        )
                        .stream()
                        .map(
                                this::toDocumentResponse
                        )
                        .toList();

        long required =
                documents.stream()
                        .filter(
                                ComplianceDocumentResponse::
                                        required
                        )
                        .count();

        long validRequired =
                documents.stream()
                        .filter(
                                ComplianceDocumentResponse::
                                        required
                        )
                        .filter(
                                document ->
                                        document.status()
                                                == ComplianceDocumentStatus.VALID
                                        ||
                                        document.status()
                                                == ComplianceDocumentStatus.NO_EXPIRY
                        )
                        .count();

        long expiring =
                documents.stream()
                        .filter(
                                document ->
                                        document.status()
                                                == ComplianceDocumentStatus.EXPIRING_SOON
                        )
                        .count();

        long expired =
                documents.stream()
                        .filter(
                                document ->
                                        document.status()
                                                == ComplianceDocumentStatus.EXPIRED
                        )
                        .count();

        return new SupplierComplianceResponse(
                supplier.getId(),
                supplier.getSupplierCode(),
                supplier.getLegalName(),
                documents.size(),
                required,
                validRequired,
                expiring,
                expired,
                calculator.complianceScore(
                        required,
                        validRequired
                ),
                documents
        );
    }

    @Transactional(readOnly = true)
    public ContractSummaryResponse summary(
            UUID currentUserId
    ) {
        findCurrentUser(
                currentUserId
        );

        LocalDate today =
                today();

        List<SupplierContractEntity> contracts =
                contractRepository
                        .findAll();

        List<SupplierComplianceDocumentEntity> documents =
                documentRepository
                        .findAll();

        long active =
                contracts.stream()
                        .filter(
                                contract ->
                                        effectiveStatus(
                                                contract
                                        )
                                                == ContractStatus.ACTIVE
                        )
                        .count();

        long expiring =
                contracts.stream()
                        .filter(
                                contract ->
                                        effectiveStatus(
                                                contract
                                        )
                                                == ContractStatus.ACTIVE
                        )
                        .filter(
                                contract -> {
                                    long days =
                                            calculator.daysUntil(
                                                    contract.getEndDate(),
                                                    today
                                            );

                                    return days >= 0
                                            &&
                                            days <= EXPIRING_SOON_DAYS;
                                }
                        )
                        .count();

        long expired =
                contracts.stream()
                        .filter(
                                contract ->
                                        effectiveStatus(
                                                contract
                                        )
                                                == ContractStatus.EXPIRED
                        )
                        .count();

        BigDecimal activeValue =
                contracts.stream()
                        .filter(
                                contract ->
                                        effectiveStatus(
                                                contract
                                        )
                                                == ContractStatus.ACTIVE
                        )
                        .map(
                                SupplierContractEntity::
                                        getContractValue
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        long expiringDocuments =
                documents.stream()
                        .filter(
                                document ->
                                        calculator.documentStatus(
                                                document.getExpiryDate(),
                                                today
                                        )
                                                == ComplianceDocumentStatus.EXPIRING_SOON
                        )
                        .count();

        long expiredDocuments =
                documents.stream()
                        .filter(
                                document ->
                                        calculator.documentStatus(
                                                document.getExpiryDate(),
                                                today
                                        )
                                                == ComplianceDocumentStatus.EXPIRED
                        )
                        .count();

        long suppliersWithIssues =
                documents.stream()
                        .filter(
                                document -> {
                                    ComplianceDocumentStatus status =
                                            calculator.documentStatus(
                                                    document.getExpiryDate(),
                                                    today
                                            );

                                    return status
                                            == ComplianceDocumentStatus.EXPIRED
                                            ||
                                            status
                                            == ComplianceDocumentStatus.EXPIRING_SOON;
                                }
                        )
                        .map(
                                document ->
                                        document.getSupplier()
                                                .getId()
                        )
                        .distinct()
                        .count();

        return new ContractSummaryResponse(
                contracts.size(),
                active,
                expiring,
                expired,
                activeValue,
                expiringDocuments,
                expiredDocuments,
                suppliersWithIssues
        );
    }

    @Transactional(readOnly = true)
    public List<ContractAlertResponse> alerts(
            UUID currentUserId
    ) {
        findCurrentUser(
                currentUserId
        );

        LocalDate today =
                today();

        List<ContractAlertResponse> alerts =
                new ArrayList<>();

        for (
                SupplierContractEntity contract
                : contractRepository.findAll()
        ) {
            ContractStatus status =
                    effectiveStatus(
                            contract
                    );

            long days =
                    calculator.daysUntil(
                            contract.getEndDate(),
                            today
                    );

            if (
                    status == ContractStatus.EXPIRED
            ) {
                alerts.add(
                        new ContractAlertResponse(
                                "CONTRACT_EXPIRED",
                                "HIGH",
                                contract.getSupplier()
                                        .getId(),
                                contract.getSupplier()
                                        .getLegalName(),
                                contract.getId(),
                                contract.getContractNumber(),
                                contract.getTitle()
                                        + " has expired.",
                                contract.getEndDate(),
                                days,
                                "/contracts/"
                                        + contract.getId()
                        )
                );
            } else if (
                    status == ContractStatus.ACTIVE
                    &&
                    days >= 0
                    &&
                    days <= EXPIRING_SOON_DAYS
            ) {
                alerts.add(
                        new ContractAlertResponse(
                                "CONTRACT_EXPIRY",
                                days <= 7
                                        ? "HIGH"
                                        : "WARNING",
                                contract.getSupplier()
                                        .getId(),
                                contract.getSupplier()
                                        .getLegalName(),
                                contract.getId(),
                                contract.getContractNumber(),
                                contract.getTitle()
                                        + " is approaching expiry.",
                                contract.getEndDate(),
                                days,
                                "/contracts/"
                                        + contract.getId()
                        )
                );
            }
        }

        for (
                SupplierComplianceDocumentEntity document
                : documentRepository.findAll()
        ) {
            ComplianceDocumentStatus status =
                    calculator.documentStatus(
                            document.getExpiryDate(),
                            today
                    );

            if (
                    status
                            == ComplianceDocumentStatus.EXPIRED
                    ||
                    status
                            == ComplianceDocumentStatus.EXPIRING_SOON
            ) {
                long days =
                        calculator.daysUntil(
                                document.getExpiryDate(),
                                today
                        );

                alerts.add(
                        new ContractAlertResponse(
                                status
                                        == ComplianceDocumentStatus.EXPIRED
                                        ? "COMPLIANCE_EXPIRED"
                                        : "COMPLIANCE_EXPIRY",
                                status
                                        == ComplianceDocumentStatus.EXPIRED
                                        ||
                                        days <= 7
                                        ? "HIGH"
                                        : "WARNING",
                                document.getSupplier()
                                        .getId(),
                                document.getSupplier()
                                        .getLegalName(),
                                document.getContract() == null
                                        ? null
                                        : document.getContract()
                                                .getId(),
                                document.getContract() == null
                                        ? null
                                        : document.getContract()
                                                .getContractNumber(),
                                document.getDocumentName()
                                        + (
                                                status
                                                        == ComplianceDocumentStatus.EXPIRED
                                                        ? " has expired."
                                                        : " is approaching expiry."
                                        ),
                                document.getExpiryDate(),
                                days,
                                document.getContract() == null
                                        ? "/suppliers/"
                                                + document.getSupplier()
                                                        .getId()
                                        : "/contracts/"
                                                + document.getContract()
                                                        .getId()
                        )
                );
            }
        }

        return alerts.stream()
                .sorted(
                        Comparator.comparing(
                                ContractAlertResponse::dueDate,
                                Comparator.nullsLast(
                                        Comparator.naturalOrder()
                                )
                        )
                )
                .toList();
    }

    private ContractResponse toContractResponse(
            SupplierContractEntity contract
    ) {
        LocalDate today =
                today();

        ContractStatus effective =
                effectiveStatus(
                        contract
                );

        long days =
                calculator.daysUntil(
                        contract.getEndDate(),
                        today
                );

        return new ContractResponse(
                contract.getId(),
                contract.getContractNumber(),
                contract.getSupplier()
                        .getId(),
                contract.getSupplier()
                        .getSupplierCode(),
                contract.getSupplier()
                        .getLegalName(),
                contract.getTitle(),
                contract.getContractType(),
                effective,
                contract.getStartDate(),
                contract.getEndDate(),
                contract.getCurrency(),
                contract.getContractValue(),
                contract.isAutoRenew(),
                contract.getNoticePeriodDays(),
                contract.getOwner()
                        .getId(),
                contract.getOwner()
                        .getFullName(),
                contract.getNotes(),
                days,
                effective
                        == ContractStatus.ACTIVE
                        &&
                        days >= 0
                        &&
                        days <= EXPIRING_SOON_DAYS,
                contract.getCreatedAt(),
                contract.getUpdatedAt(),
                contract.getVersion()
        );
    }

    private ComplianceDocumentResponse
    toDocumentResponse(
            SupplierComplianceDocumentEntity document
    ) {
        LocalDate today =
                today();

        ComplianceDocumentStatus status =
                calculator.documentStatus(
                        document.getExpiryDate(),
                        today
                );

        SupplierContractEntity contract =
                document.getContract();

        return new ComplianceDocumentResponse(
                document.getId(),
                document.getSupplier()
                        .getId(),
                contract == null
                        ? null
                        : contract.getId(),
                contract == null
                        ? null
                        : contract.getContractNumber(),
                document.getDocumentType(),
                document.getDocumentName(),
                document.getDocumentReference(),
                document.isRequired(),
                document.getIssueDate(),
                document.getExpiryDate(),
                status,
                calculator.daysUntil(
                        document.getExpiryDate(),
                        today
                ),
                document.getNotes(),
                document.getCreatedBy()
                        .getId(),
                document.getCreatedBy()
                        .getFullName(),
                document.getCreatedAt(),
                document.getUpdatedAt(),
                document.getVersion()
        );
    }

    private ContractStatus effectiveStatus(
            SupplierContractEntity contract
    ) {
        if (
                contract.getStatus()
                        == ContractStatus.TERMINATED
                ||
                contract.getStatus()
                        == ContractStatus.DRAFT
        ) {
            return contract.getStatus();
        }

        if (
                contract.getEndDate()
                        .isBefore(
                                today()
                        )
        ) {
            return ContractStatus.EXPIRED;
        }

        return contract.getStatus();
    }

    private void applyDocumentInput(
            SupplierComplianceDocumentEntity document,
            ComplianceDocumentInput input
    ) {
        document.setDocumentType(
                normalizeRequired(
                        input.documentType()
                )
        );

        document.setDocumentName(
                normalizeRequired(
                        input.documentName()
                )
        );

        document.setDocumentReference(
                normalizeOptional(
                        input.documentReference()
                )
        );

        document.setRequired(
                input.required()
        );

        document.setIssueDate(
                input.issueDate()
        );

        document.setExpiryDate(
                input.expiryDate()
        );

        document.setNotes(
                normalizeOptional(
                        input.notes()
                )
        );
    }

    private SupplierContractEntity resolveContract(
            UUID supplierId,
            UUID contractId
    ) {
        if (contractId == null) {
            return null;
        }

        SupplierContractEntity contract =
                findContractEntity(
                        contractId
                );

        if (
                !contract.getSupplier()
                        .getId()
                        .equals(
                                supplierId
                        )
        ) {
            throw new IllegalArgumentException(
                    "Compliance document contract must belong to the same supplier."
            );
        }

        return contract;
    }

    private SupplierContractEntity findContractEntity(
            UUID contractId
    ) {
        return contractRepository
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
    }

    private SupplierEntity findSupplier(
            UUID supplierId
    ) {
        return supplierRepository
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
                    "Your ProcureIQ role cannot manage contracts or compliance documents."
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
                    "Only administrators and procurement managers can terminate contracts."
            );
        }
    }

    private void validateContractDates(
            LocalDate startDate,
            LocalDate endDate
    ) {
        if (
                endDate.isBefore(
                        startDate
                )
        ) {
            throw new IllegalArgumentException(
                    "Contract end date must not be before start date."
            );
        }
    }

    private void validateDocumentDates(
            LocalDate issueDate,
            LocalDate expiryDate
    ) {
        if (
                issueDate != null
                &&
                expiryDate != null
                &&
                expiryDate.isBefore(
                        issueDate
                )
        ) {
            throw new IllegalArgumentException(
                    "Compliance document expiry date must not be before issue date."
            );
        }
    }

    private String nextContractNumber() {
        Long sequence =
                contractRepository
                        .nextContractSequence();

        int year =
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue();

        return String.format(
                "CTR-%d-%05d",
                year,
                sequence
        );
    }

    private LocalDate today() {
        return LocalDate.now(
                ZoneOffset.UTC
        );
    }

    private BigDecimal money(
            BigDecimal value
    ) {
        return value.setScale(
                2,
                RoundingMode.HALF_UP
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
}
