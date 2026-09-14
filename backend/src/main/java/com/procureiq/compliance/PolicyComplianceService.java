package com.procureiq.compliance;

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
import java.util.concurrent.atomic.AtomicLong;

@Service
@Transactional
public class PolicyComplianceService {

    private final PolicyComplianceRepository repository;

    private final PolicyComplianceCalculationService calculationService;

    private final AppUserRepository appUserRepository;

    public PolicyComplianceService(
            PolicyComplianceRepository repository,
            PolicyComplianceCalculationService calculationService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.calculationService =
                calculationService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public List<ProcurementPolicyResponse> policies(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        return repository
                .findPolicies()
                .stream()
                .map(
                        this::policyResponse
                )
                .toList();
    }

    public ProcurementPolicyResponse createPolicy(
            UUID currentUserId,
            ProcurementPolicyInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertAdminRole(
                currentUser.getRole()
        );

        validatePolicyInput(
                input
        );

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireAssignableUser(
                                input.ownerUserId()
                        ).getId();

        String policyCode =
                normalizePolicyCode(
                        input.policyCode()
                );

        String currency =
                normalizeOptionalCurrency(
                        input.currency()
                );

        UUID id =
                UUID.randomUUID();

        try {
            repository.createPolicy(
                    id,
                    input,
                    ownerId,
                    policyCode,
                    currency
            );
        } catch (
                DataIntegrityViolationException exception
        ) {
            throw new IllegalArgumentException(
                    "A procurement policy already exists with code "
                            + policyCode
                            + "."
            );
        }

        return policyResponse(
                requirePolicy(
                        id
                )
        );
    }

    public ProcurementPolicyResponse activatePolicy(
            UUID currentUserId,
            UUID policyId
    ) {
        assertAdminRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        requirePolicy(
                policyId
        );

        repository.updatePolicyStatus(
                policyId,
                ProcurementPolicyStatus.ACTIVE
        );

        return policyResponse(
                requirePolicy(
                        policyId
                )
        );
    }

    public ProcurementPolicyResponse deactivatePolicy(
            UUID currentUserId,
            UUID policyId
    ) {
        assertAdminRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        requirePolicy(
                policyId
        );

        repository.updatePolicyStatus(
                policyId,
                ProcurementPolicyStatus.INACTIVE
        );

        return policyResponse(
                requirePolicy(
                        policyId
                )
        );
    }

    public PolicyEvaluationResponse evaluate(
            UUID currentUserId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        List<PolicyComplianceRepository.PolicyRow> policies =
                repository
                        .findActivePolicies();

        AtomicLong candidatesEvaluated =
                new AtomicLong();

        AtomicLong createdViolations =
                new AtomicLong();

        AtomicLong refreshedViolations =
                new AtomicLong();

        for (
                PolicyComplianceRepository.PolicyRow policy
                : policies
        ) {
            List<PolicyComplianceRepository.CandidateRow> candidates =
                    candidatesFor(
                            policy
                    );

            candidatesEvaluated.addAndGet(
                    candidates.size()
            );

            for (
                    PolicyComplianceRepository.CandidateRow candidate
                    : candidates
            ) {
                String sourceKey =
                        "POLICY:"
                                + policy.id()
                                + ":"
                                + candidate.sourceType()
                                + ":"
                                + candidate.sourceId();

                PolicyComplianceRepository.ViolationRow existing =
                        repository
                                .findViolationBySourceKey(
                                        sourceKey
                                );

                if (existing == null) {
                    repository.createViolation(
                            UUID.randomUUID(),
                            policy.id(),
                            sourceKey,
                            candidate,
                            policy.severity()
                    );

                    createdViolations
                            .incrementAndGet();
                } else if (
                        existing.status()
                                != PolicyViolationStatus.WAIVED
                ) {
                    repository.refreshViolation(
                            existing.id(),
                            candidate,
                            policy.severity()
                    );

                    refreshedViolations
                            .incrementAndGet();
                }
            }
        }

        return new PolicyEvaluationResponse(
                policies.size(),
                candidatesEvaluated.get(),
                createdViolations.get(),
                refreshedViolations.get()
        );
    }

    @Transactional(readOnly = true)
    public List<PolicyViolationResponse> violations(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        return repository
                .findViolations()
                .stream()
                .map(
                        this::violationResponse
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public PolicyViolationDetailResponse violationDetail(
            UUID currentUserId,
            UUID violationId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        PolicyComplianceRepository.ViolationRow violation =
                requireViolation(
                        violationId
                );

        return new PolicyViolationDetailResponse(
                violationResponse(
                        violation
                ),
                repository
                        .findWaivers(
                                violationId
                        )
                        .stream()
                        .map(
                                this::waiverResponse
                        )
                        .toList(),
                repository
                        .findEvidence(
                                violationId
                        )
                        .stream()
                        .map(
                                this::evidenceResponse
                        )
                        .toList()
        );
    }

    public PolicyWaiverResponse requestWaiver(
            UUID currentUserId,
            UUID violationId,
            PolicyWaiverInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        PolicyComplianceRepository.ViolationRow violation =
                requireViolation(
                        violationId
                );

        if (
                violation.status()
                        != PolicyViolationStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open policy violations can request a waiver."
            );
        }

        PolicyComplianceRepository.PolicyRow policy =
                requirePolicy(
                        violation.policyId()
                );

        if (!policy.requiresWaiver()) {
            throw new IllegalArgumentException(
                    "This policy is not configured for waiver governance."
            );
        }

        UUID waiverId =
                UUID.randomUUID();

        repository.createWaiver(
                waiverId,
                nextWaiverNumber(),
                violationId,
                input.rationale(),
                currentUserId
        );

        return waiverResponse(
                requireWaiver(
                        waiverId
                )
        );
    }

    public PolicyWaiverResponse approveWaiver(
            UUID currentUserId,
            UUID waiverId,
            PolicyDecisionInput input
    ) {
        assertAdminRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        PolicyComplianceRepository.WaiverRow waiver =
                requireWaiver(
                        waiverId
                );

        if (
                waiver.status()
                        != PolicyWaiverStatus.SUBMITTED
        ) {
            throw new IllegalArgumentException(
                    "Only submitted waivers can be approved."
            );
        }

        repository.decideWaiver(
                waiverId,
                PolicyWaiverStatus.APPROVED,
                currentUserId,
                input.note()
        );

        return waiverResponse(
                requireWaiver(
                        waiverId
                )
        );
    }

    public PolicyWaiverResponse rejectWaiver(
            UUID currentUserId,
            UUID waiverId,
            PolicyDecisionInput input
    ) {
        assertAdminRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        PolicyComplianceRepository.WaiverRow waiver =
                requireWaiver(
                        waiverId
                );

        if (
                waiver.status()
                        != PolicyWaiverStatus.SUBMITTED
        ) {
            throw new IllegalArgumentException(
                    "Only submitted waivers can be rejected."
            );
        }

        repository.decideWaiver(
                waiverId,
                PolicyWaiverStatus.REJECTED,
                currentUserId,
                input.note()
        );

        return waiverResponse(
                requireWaiver(
                        waiverId
                )
        );
    }

    public PolicyEvidenceResponse addEvidence(
            UUID currentUserId,
            UUID violationId,
            PolicyEvidenceInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        requireViolation(
                violationId
        );

        UUID evidenceId =
                UUID.randomUUID();

        repository.addEvidence(
                evidenceId,
                violationId,
                input,
                currentUserId
        );

        return repository
                .findEvidence(
                        violationId
                )
                .stream()
                .filter(
                        evidence ->
                                evidence.id()
                                        .equals(
                                                evidenceId
                                        )
                )
                .map(
                        this::evidenceResponse
                )
                .findFirst()
                .orElseThrow(
                        () ->
                                new IllegalStateException(
                                        "Created compliance evidence could not be reloaded."
                                )
                );
    }

    public PolicyViolationResponse resolveViolation(
            UUID currentUserId,
            UUID violationId,
            PolicyDecisionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        PolicyComplianceRepository.ViolationRow violation =
                requireViolation(
                        violationId
                );

        if (
                violation.status()
                        != PolicyViolationStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open policy violations can be resolved."
            );
        }

        repository.resolveViolation(
                violationId,
                currentUserId,
                input.note()
        );

        return violationResponse(
                requireViolation(
                        violationId
                )
        );
    }

    @Transactional(readOnly = true)
    public PolicyComplianceSummaryResponse summary(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        List<PolicyComplianceRepository.PolicyRow> policies =
                repository
                        .findPolicies();

        List<PolicyComplianceRepository.ViolationRow> violations =
                repository
                        .findViolations();

        long activePolicies =
                policies.stream()
                        .filter(
                                policy ->
                                        policy.status()
                                                == ProcurementPolicyStatus.ACTIVE
                        )
                        .count();

        long open =
                violations.stream()
                        .filter(
                                violation ->
                                        violation.status()
                                                == PolicyViolationStatus.OPEN
                        )
                        .count();

        long pendingWaivers =
                violations.stream()
                        .filter(
                                violation ->
                                        violation.status()
                                                == PolicyViolationStatus.WAIVER_REQUESTED
                        )
                        .count();

        long waived =
                violations.stream()
                        .filter(
                                violation ->
                                        violation.status()
                                                == PolicyViolationStatus.WAIVED
                        )
                        .count();

        long resolved =
                violations.stream()
                        .filter(
                                violation ->
                                        violation.status()
                                                == PolicyViolationStatus.RESOLVED
                        )
                        .count();

        long critical =
                violations.stream()
                        .filter(
                                violation ->
                                        violation.status()
                                                != PolicyViolationStatus.RESOLVED
                                        &&
                                        violation.severity()
                                                == ProcurementPolicySeverity.CRITICAL
                        )
                        .count();

        long high =
                violations.stream()
                        .filter(
                                violation ->
                                        violation.status()
                                                != PolicyViolationStatus.RESOLVED
                                        &&
                                        violation.severity()
                                                == ProcurementPolicySeverity.HIGH
                        )
                        .count();

        return new PolicyComplianceSummaryResponse(
                policies.size(),
                activePolicies,
                violations.size(),
                open,
                critical,
                high,
                pendingWaivers,
                waived,
                resolved,
                calculationService
                        .resolutionRate(
                                violations.size(),
                                open,
                                pendingWaivers
                        )
        );
    }

    @Transactional(readOnly = true)
    public PolicyComplianceContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        return new PolicyComplianceContextResponse(
                repository.users()
        );
    }

    private List<PolicyComplianceRepository.CandidateRow>
    candidatesFor(
            PolicyComplianceRepository.PolicyRow policy
    ) {
        return switch (
                policy.policyType()
        ) {
            case COMPETITIVE_SOURCING_THRESHOLD ->
                    repository
                            .competitiveSourcingCandidates(
                                    requiredThreshold(
                                            policy
                                    ),
                                    policy.currency()
                            );

            case PURCHASE_ORDER_REQUIRED_THRESHOLD ->
                    repository
                            .purchaseOrderRequiredCandidates(
                                    requiredThreshold(
                                            policy
                                    ),
                                    policy.currency()
                            );

            case CONTRACT_REQUIRED_THRESHOLD ->
                    repository
                            .contractRequiredCandidates(
                                    requiredThreshold(
                                            policy
                                    ),
                                    policy.currency()
                            );

            case HIGH_RISK_SUPPLIER_RESTRICTION ->
                    repository
                            .highRiskSupplierCandidates(
                                    policy.currency()
                            );
        };
    }

    private BigDecimal requiredThreshold(
            PolicyComplianceRepository.PolicyRow policy
    ) {
        if (
                policy.thresholdAmount()
                        == null
        ) {
            throw new IllegalStateException(
                    "Threshold policy "
                            + policy.policyCode()
                            + " has no configured threshold amount."
            );
        }

        return policy.thresholdAmount();
    }

    private ProcurementPolicyResponse policyResponse(
            PolicyComplianceRepository.PolicyRow row
    ) {
        return new ProcurementPolicyResponse(
                row.id(),
                row.policyCode(),
                row.name(),
                row.description(),
                row.policyType(),
                row.severity(),
                row.status(),
                moneyNullable(
                        row.thresholdAmount()
                ),
                row.currency(),
                row.requiresWaiver(),
                row.ownerUserId(),
                row.ownerName(),
                row.openViolations(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private PolicyViolationResponse violationResponse(
            PolicyComplianceRepository.ViolationRow row
    ) {
        return new PolicyViolationResponse(
                row.id(),
                row.policyId(),
                row.policyCode(),
                row.policyName(),
                row.policyType(),
                row.sourceType(),
                row.sourceId(),
                row.sourceReference(),
                moneyNullable(
                        row.sourceAmount()
                ),
                row.currency(),
                row.severity(),
                row.status(),
                row.details(),
                row.policyOwnerName(),
                sourceHref(
                        row
                ),
                row.detectedAt(),
                row.lastCheckedAt(),
                row.resolutionNote(),
                row.resolvedAt(),
                row.resolvedByName(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private PolicyWaiverResponse waiverResponse(
            PolicyComplianceRepository.WaiverRow row
    ) {
        return new PolicyWaiverResponse(
                row.id(),
                row.waiverNumber(),
                row.violationId(),
                row.rationale(),
                row.status(),
                row.requestedByUserId(),
                row.requestedByName(),
                row.requestedAt(),
                row.decisionNote(),
                row.decidedByName(),
                row.decidedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private PolicyEvidenceResponse evidenceResponse(
            PolicyComplianceRepository.EvidenceRow row
    ) {
        return new PolicyEvidenceResponse(
                row.id(),
                row.violationId(),
                row.evidenceType(),
                row.content(),
                row.addedByUserId(),
                row.addedByName(),
                row.createdAt()
        );
    }

    private String sourceHref(
            PolicyComplianceRepository.ViolationRow row
    ) {
        return switch (
                row.sourceType()
        ) {
            case PURCHASE_REQUEST ->
                    "/requests/"
                            + row.sourceId();

            case PURCHASE_ORDER ->
                    "/purchase-orders/"
                            + row.sourceId();
        };
    }

    private PolicyComplianceRepository.PolicyRow requirePolicy(
            UUID policyId
    ) {
        PolicyComplianceRepository.PolicyRow policy =
                repository
                        .findPolicy(
                                policyId
                        );

        if (policy == null) {
            throw new ResourceNotFoundException(
                    "Procurement policy not found: "
                            + policyId
            );
        }

        return policy;
    }

    private PolicyComplianceRepository.ViolationRow requireViolation(
            UUID violationId
    ) {
        PolicyComplianceRepository.ViolationRow violation =
                repository
                        .findViolation(
                                violationId
                        );

        if (violation == null) {
            throw new ResourceNotFoundException(
                    "Policy violation not found: "
                            + violationId
            );
        }

        return violation;
    }

    private PolicyComplianceRepository.WaiverRow requireWaiver(
            UUID waiverId
    ) {
        PolicyComplianceRepository.WaiverRow waiver =
                repository
                        .findWaiver(
                                waiverId
                        );

        if (waiver == null) {
            throw new ResourceNotFoundException(
                    "Policy waiver not found: "
                            + waiverId
            );
        }

        return waiver;
    }

    private String nextWaiverNumber() {
        Long sequence =
                repository
                        .nextWaiverSequence();

        return String.format(
                "WVR-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                sequence
        );
    }

    private void validatePolicyInput(
            ProcurementPolicyInput input
    ) {
        boolean thresholdPolicy =
                input.policyType()
                        != ProcurementPolicyType.HIGH_RISK_SUPPLIER_RESTRICTION;

        if (
                thresholdPolicy
                &&
                input.thresholdAmount()
                        == null
        ) {
            throw new IllegalArgumentException(
                    "This policy type requires a threshold amount."
            );
        }

        if (
                input.currency()
                        != null
                &&
                !input.currency()
                        .isBlank()
                &&
                input.currency()
                        .trim()
                        .length()
                        != 3
        ) {
            throw new IllegalArgumentException(
                    "Policy currency must contain exactly three characters."
            );
        }
    }

    private String normalizePolicyCode(
            String policyCode
    ) {
        return policyCode
                .trim()
                .toUpperCase(
                        Locale.ROOT
                )
                .replaceAll(
                        "[^A-Z0-9_-]",
                        "_"
                );
    }

    private String normalizeOptionalCurrency(
            String currency
    ) {
        if (
                currency == null
                ||
                currency.isBlank()
        ) {
            return null;
        }

        return currency
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    private BigDecimal moneyNullable(
            BigDecimal value
    ) {
        return value == null
                ? null
                : value.setScale(
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

    private AppUserEntity requireAssignableUser(
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
                    "Procurement policy ownership requires a governance role."
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
                    "Your ProcureIQ role cannot access procurement compliance."
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
                    "Your ProcureIQ role cannot manage procurement compliance actions."
            );
        }
    }

    private void assertAdminRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can manage procurement policies and waiver decisions."
            );
        }
    }
}
