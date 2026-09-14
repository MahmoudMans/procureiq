package com.procureiq.supplieronboarding;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class SupplierOnboardingService {

    private final SupplierOnboardingRepository repository;

    private final SupplierOnboardingGateService gateService;

    private final AppUserRepository appUserRepository;

    public SupplierOnboardingService(
            SupplierOnboardingRepository repository,
            SupplierOnboardingGateService gateService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.gateService =
                gateService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public List<SupplierOnboardingCaseResponse> cases(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return repository
                .findCases()
                .stream()
                .map(
                        this::caseResponse
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public SupplierOnboardingCaseResponse caseDetail(
            UUID currentUserId,
            UUID caseId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return caseResponse(
                requireCase(
                        caseId
                )
        );
    }

    public SupplierOnboardingCaseResponse createCase(
            UUID currentUserId,
            SupplierOnboardingCaseInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        SupplierOnboardingRepository.SupplierRow supplier =
                repository
                        .findSupplier(
                                input.supplierId()
                        );

        if (supplier == null) {
            throw new ResourceNotFoundException(
                    "Supplier not found: "
                            + input.supplierId()
            );
        }

        if (
                repository
                        .hasOpenCase(
                                input.supplierId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Supplier already has an open onboarding or requalification case."
            );
        }

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireGovernanceUser(
                                input.ownerUserId()
                        )
                                .getId();

        UUID caseId =
                UUID.randomUUID();

        Instant slaDueAt =
                Instant.now()
                        .plus(
                                gateService
                                        .slaDays(
                                                input.riskTier()
                                        ),
                                ChronoUnit.DAYS
                        );

        repository.createCase(
                caseId,
                nextCaseNumber(),
                input,
                ownerId,
                slaDueAt
        );

        seedQuestions(
                caseId
        );

        seedEvidence(
                caseId,
                input.riskTier()
        );

        return caseResponse(
                requireCase(
                        caseId
                )
        );
    }

    public SupplierOnboardingCaseResponse answerQuestion(
            UUID currentUserId,
            UUID caseId,
            String questionCode,
            QualificationAnswerInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierOnboardingRepository.CaseRow onboardingCase =
                requireEditableCase(
                        caseId
                );

        boolean exists =
                repository
                        .findQuestions(
                                caseId
                        )
                        .stream()
                        .anyMatch(
                                question ->
                                        question.questionCode()
                                                .equals(
                                                        questionCode
                                                )
                        );

        if (!exists) {
            throw new ResourceNotFoundException(
                    "Qualification question not found: "
                            + questionCode
            );
        }

        repository.answerQuestion(
                onboardingCase.id(),
                questionCode,
                input,
                currentUserId
        );

        return caseResponse(
                requireCase(
                        caseId
                )
        );
    }

    public SupplierOnboardingCaseResponse uploadEvidence(
            UUID currentUserId,
            UUID caseId,
            OnboardingEvidenceType evidenceType,
            OnboardingEvidenceInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        requireEditableCase(
                caseId
        );

        SupplierOnboardingRepository.EvidenceRow evidence =
                repository
                        .findEvidenceByType(
                                caseId,
                                evidenceType
                        );

        if (evidence == null) {
            throw new ResourceNotFoundException(
                    "Onboarding evidence requirement not found: "
                            + evidenceType
            );
        }

        repository.uploadEvidence(
                caseId,
                evidenceType,
                input
        );

        return caseResponse(
                requireCase(
                        caseId
                )
        );
    }

    public OnboardingEvidenceResponse validateEvidence(
            UUID currentUserId,
            UUID evidenceId,
            OnboardingDecisionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierOnboardingRepository.EvidenceRow evidence =
                requireEvidence(
                        evidenceId
                );

        SupplierOnboardingRepository.CaseRow onboardingCase =
                requireEditableCase(
                        evidence.caseId()
                );

        if (
                evidence.documentReference()
                        == null
                ||
                evidence.documentReference()
                        .isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Evidence must be uploaded before validation."
            );
        }

        if (
                evidence.expiryDate()
                        != null
                &&
                evidence.expiryDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Expired evidence cannot be validated."
            );
        }

        repository.reviewEvidence(
                evidenceId,
                OnboardingEvidenceStatus.VALID,
                currentUserId,
                input.note()
        );

        return evidenceResponse(
                requireEvidence(
                        evidenceId
                )
        );
    }

    public OnboardingEvidenceResponse rejectEvidence(
            UUID currentUserId,
            UUID evidenceId,
            OnboardingDecisionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierOnboardingRepository.EvidenceRow evidence =
                requireEvidence(
                        evidenceId
                );

        requireEditableCase(
                evidence.caseId()
        );

        repository.reviewEvidence(
                evidenceId,
                OnboardingEvidenceStatus.REJECTED,
                currentUserId,
                input.note()
        );

        return evidenceResponse(
                requireEvidence(
                        evidenceId
                )
        );
    }

    public SupplierOnboardingCaseResponse submitCase(
            UUID currentUserId,
            UUID caseId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierOnboardingRepository.CaseRow onboardingCase =
                requireCase(
                        caseId
                );

        if (
                onboardingCase.status()
                        != SupplierOnboardingStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft onboarding cases can be submitted."
            );
        }

        if (
                onboardingCase.answeredMandatoryQuestions()
                        <
                        onboardingCase.mandatoryQuestions()
        ) {
            throw new IllegalArgumentException(
                    "All mandatory qualification questions must be answered before submission."
            );
        }

        long suppliedMandatoryEvidence =
                repository
                        .findEvidence(
                                caseId
                        )
                        .stream()
                        .filter(
                                SupplierOnboardingRepository.EvidenceRow::
                                        mandatory
                        )
                        .filter(
                                evidence ->
                                        evidence.documentReference()
                                                != null
                                        &&
                                        !evidence.documentReference()
                                                .isBlank()
                        )
                        .count();

        if (
                suppliedMandatoryEvidence
                        <
                        onboardingCase.mandatoryEvidence()
        ) {
            throw new IllegalArgumentException(
                    "All mandatory evidence must be supplied before submission."
            );
        }

        for (
                OnboardingApprovalLevel level
                : gateService
                        .requiredApprovalLevels(
                                onboardingCase.riskTier()
                        )
        ) {
            repository.createApproval(
                    caseId,
                    level,
                    true
            );
        }

        repository.submitCase(
                caseId
        );

        return caseResponse(
                requireCase(
                        caseId
                )
        );
    }

    public OnboardingApprovalResponse approve(
            UUID currentUserId,
            UUID approvalId,
            OnboardingDecisionInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        SupplierOnboardingRepository.ApprovalRow approval =
                requireApproval(
                        approvalId
                );

        assertApprovalRole(
                user.getRole(),
                approval.approvalLevel()
        );

        SupplierOnboardingRepository.CaseRow onboardingCase =
                requireCase(
                        approval.caseId()
                );

        if (
                onboardingCase.status()
                        != SupplierOnboardingStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Approval decisions require an onboarding case in review."
            );
        }

        if (
                approval.status()
                        != OnboardingApprovalStatus.PENDING
        ) {
            throw new IllegalArgumentException(
                    "This onboarding approval has already been decided."
            );
        }

        repository.decideApproval(
                approvalId,
                OnboardingApprovalStatus.APPROVED,
                currentUserId,
                input.note()
        );

        return approvalResponse(
                requireApproval(
                        approvalId
                )
        );
    }

    public OnboardingApprovalResponse rejectApproval(
            UUID currentUserId,
            UUID approvalId,
            OnboardingDecisionInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        SupplierOnboardingRepository.ApprovalRow approval =
                requireApproval(
                        approvalId
                );

        assertApprovalRole(
                user.getRole(),
                approval.approvalLevel()
        );

        SupplierOnboardingRepository.CaseRow onboardingCase =
                requireCase(
                        approval.caseId()
                );

        if (
                onboardingCase.status()
                        != SupplierOnboardingStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Approval decisions require an onboarding case in review."
            );
        }

        repository.decideApproval(
                approvalId,
                OnboardingApprovalStatus.REJECTED,
                currentUserId,
                input.note()
        );

        repository.rejectCase(
                approval.caseId(),
                approval.approvalLevel()
                        + " approval rejected: "
                        + input.note()
        );

        return approvalResponse(
                requireApproval(
                        approvalId
                )
        );
    }

    public SupplierOnboardingCaseResponse finalizeCase(
            UUID currentUserId,
            UUID caseId,
            OnboardingDecisionInput input
    ) {
        assertFinalizationRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierOnboardingRepository.CaseRow onboardingCase =
                requireCase(
                        caseId
                );

        if (
                onboardingCase.status()
                        != SupplierOnboardingStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only onboarding cases in review can be finalized."
            );
        }

        OnboardingGateEvaluation evaluation =
                gateEvaluation(
                        onboardingCase
                );

        if (
                !evaluation.activationEligible()
        ) {
            throw new IllegalArgumentException(
                    "Supplier cannot receive activation clearance: "
                            + String.join(
                                    " ",
                                    evaluation.reasons()
                            )
            );
        }

        LocalDate requalificationDue =
                LocalDate.now(
                        ZoneOffset.UTC
                )
                        .plusDays(
                                gateService
                                        .requalificationDays(
                                                onboardingCase.riskTier()
                                        )
                        );

        repository.finalizeCase(
                caseId,
                requalificationDue,
                input.note()
        );

        return caseResponse(
                requireCase(
                        caseId
                )
        );
    }

    public SupplierOnboardingCaseResponse rejectCase(
            UUID currentUserId,
            UUID caseId,
            OnboardingDecisionInput input
    ) {
        assertFinalizationRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierOnboardingRepository.CaseRow onboardingCase =
                requireCase(
                        caseId
                );

        if (
                onboardingCase.status()
                        != SupplierOnboardingStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only onboarding cases in review can be rejected."
            );
        }

        repository.rejectCase(
                caseId,
                input.note()
        );

        return caseResponse(
                requireCase(
                        caseId
                )
        );
    }

    public SupplierOnboardingCaseResponse cancelCase(
            UUID currentUserId,
            UUID caseId,
            OnboardingDecisionInput input
    ) {
        assertFinalizationRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierOnboardingRepository.CaseRow onboardingCase =
                requireCase(
                        caseId
                );

        if (
                onboardingCase.status()
                        != SupplierOnboardingStatus.DRAFT
                &&
                onboardingCase.status()
                        != SupplierOnboardingStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only draft or in-review onboarding cases can be cancelled."
            );
        }

        repository.cancelCase(
                caseId,
                input.note()
        );

        return caseResponse(
                requireCase(
                        caseId
                )
        );
    }

    public SupplierOnboardingSummaryResponse summary(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        repository.expireDueRequalifications();

        List<SupplierOnboardingCaseResponse> cases =
                repository
                        .findCases()
                        .stream()
                        .map(
                                this::caseResponse
                        )
                        .toList();

        return new SupplierOnboardingSummaryResponse(
                cases.size(),
                cases.stream()
                        .filter(
                                item ->
                                        item.status()
                                                == SupplierOnboardingStatus.DRAFT
                        )
                        .count(),
                cases.stream()
                        .filter(
                                item ->
                                        item.status()
                                                == SupplierOnboardingStatus.IN_REVIEW
                        )
                        .count(),
                cases.stream()
                        .filter(
                                SupplierOnboardingCaseResponse::
                                        slaOverdue
                        )
                        .count(),
                cases.stream()
                        .filter(
                                item ->
                                        item.status()
                                                == SupplierOnboardingStatus.IN_REVIEW
                                        &&
                                        item.activationEligible()
                        )
                        .count(),
                cases.stream()
                        .filter(
                                item ->
                                        item.status()
                                                == SupplierOnboardingStatus.APPROVED
                        )
                        .count(),
                cases.stream()
                        .filter(
                                item ->
                                        item.status()
                                                == SupplierOnboardingStatus.REJECTED
                        )
                        .count(),
                cases.stream()
                        .filter(
                                SupplierOnboardingCaseResponse::
                                        requalificationDueWithin30Days
                        )
                        .count(),
                cases.stream()
                        .filter(
                                SupplierOnboardingCaseResponse::
                                        requalificationExpired
                        )
                        .count(),
                cases.stream()
                        .filter(
                                item ->
                                        item.status()
                                                == SupplierOnboardingStatus.DRAFT
                                        ||
                                        item.status()
                                                == SupplierOnboardingStatus.IN_REVIEW
                        )
                        .filter(
                                item ->
                                        item.riskTier()
                                                == SupplierOnboardingRiskTier.HIGH
                                        ||
                                        item.riskTier()
                                                == SupplierOnboardingRiskTier.CRITICAL
                        )
                        .count()
        );
    }

    @Transactional(readOnly = true)
    public SupplierOnboardingContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new SupplierOnboardingContextResponse(
                repository.suppliers(),
                repository.users()
        );
    }

    private SupplierOnboardingCaseResponse caseResponse(
            SupplierOnboardingRepository.CaseRow row
    ) {
        OnboardingGateEvaluation evaluation =
                gateEvaluation(
                        row
                );

        LocalDate today =
                LocalDate.now(
                        ZoneOffset.UTC
                );

        boolean slaOverdue =
                (
                        row.status()
                                == SupplierOnboardingStatus.DRAFT
                        ||
                        row.status()
                                == SupplierOnboardingStatus.IN_REVIEW
                )
                &&
                row.slaDueAt()
                        .isBefore(
                                Instant.now()
                        );

        long daysOpen =
                ChronoUnit.DAYS.between(
                        row.createdAt()
                                .atZone(
                                        ZoneOffset.UTC
                                )
                                .toLocalDate(),
                        (
                                row.decisionAt()
                                        == null
                                        ? Instant.now()
                                        : row.decisionAt()
                        )
                                .atZone(
                                        ZoneOffset.UTC
                                )
                                .toLocalDate()
                );

        boolean requalificationDueSoon =
                row.status()
                        == SupplierOnboardingStatus.APPROVED
                &&
                row.requalificationDueDate()
                        != null
                &&
                !row.requalificationDueDate()
                        .isBefore(
                                today
                        )
                &&
                !row.requalificationDueDate()
                        .isAfter(
                                today.plusDays(
                                        30
                                )
                        );

        boolean requalificationExpired =
                (
                        row.status()
                                == SupplierOnboardingStatus.EXPIRED
                )
                ||
                (
                        row.requalificationDueDate()
                                != null
                        &&
                        row.requalificationDueDate()
                                .isBefore(
                                        today
                                )
                );

        return new SupplierOnboardingCaseResponse(
                row.id(),
                row.caseNumber(),
                row.supplierId(),
                row.supplierCode(),
                row.supplierName(),
                row.supplierCategory(),
                row.supplierCountry(),
                row.supplierStatus(),
                row.supplierRiskLevel(),
                row.caseType(),
                row.status(),
                row.riskTier(),
                row.ownerUserId(),
                row.ownerName(),
                row.activationClearance(),
                row.status()
                                == SupplierOnboardingStatus.IN_REVIEW
                        &&
                        evaluation.activationEligible(),
                evaluation.reasons(),
                row.mandatoryQuestions(),
                row.answeredMandatoryQuestions(),
                row.nonCompliantMandatoryQuestions(),
                row.mandatoryEvidence(),
                row.validMandatoryEvidence(),
                row.requiredApprovals(),
                row.approvedRequiredApprovals(),
                row.slaDueAt(),
                slaOverdue,
                Math.max(
                        0,
                        daysOpen
                ),
                row.submittedAt(),
                row.decisionAt(),
                row.requalificationDueDate(),
                requalificationDueSoon,
                requalificationExpired,
                row.decisionNote(),
                row.notes(),
                repository
                        .findQuestions(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::questionResponse
                        )
                        .toList(),
                repository
                        .findEvidence(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::evidenceResponse
                        )
                        .toList(),
                repository
                        .findApprovals(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::approvalResponse
                        )
                        .toList(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private OnboardingGateEvaluation gateEvaluation(
            SupplierOnboardingRepository.CaseRow row
    ) {
        return gateService.evaluate(
                row.mandatoryQuestions(),
                row.answeredMandatoryQuestions(),
                row.nonCompliantMandatoryQuestions(),
                row.mandatoryEvidence(),
                row.validMandatoryEvidence(),
                row.requiredApprovals(),
                row.approvedRequiredApprovals()
        );
    }

    private QualificationQuestionResponse questionResponse(
            SupplierOnboardingRepository.QuestionRow row
    ) {
        return new QualificationQuestionResponse(
                row.id(),
                row.questionCode(),
                row.questionLabel(),
                row.mandatory(),
                row.answerValue(),
                row.complianceStatus(),
                row.answeredByUserId(),
                row.answeredByName(),
                row.answeredAt()
        );
    }

    private OnboardingEvidenceResponse evidenceResponse(
            SupplierOnboardingRepository.EvidenceRow row
    ) {
        OnboardingEvidenceStatus effectiveStatus =
                row.status();

        if (
                row.expiryDate()
                        != null
                &&
                row.expiryDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
                &&
                row.status()
                        == OnboardingEvidenceStatus.VALID
        ) {
            effectiveStatus =
                    OnboardingEvidenceStatus.EXPIRED;
        }

        return new OnboardingEvidenceResponse(
                row.id(),
                row.evidenceType(),
                row.mandatory(),
                row.documentReference(),
                row.expiryDate(),
                effectiveStatus,
                row.reviewedByName(),
                row.reviewNote(),
                row.reviewedAt()
        );
    }

    private OnboardingApprovalResponse approvalResponse(
            SupplierOnboardingRepository.ApprovalRow row
    ) {
        return new OnboardingApprovalResponse(
                row.id(),
                row.approvalLevel(),
                row.required(),
                row.status(),
                row.decidedByName(),
                row.decisionNote(),
                row.decidedAt()
        );
    }

    private void seedQuestions(
            UUID caseId
    ) {
        repository.seedQuestion(
                caseId,
                "LEGAL_ENTITY_CONFIRMED",
                "Has the supplier's legal entity identity and registration been confirmed?",
                true
        );

        repository.seedQuestion(
                caseId,
                "BENEFICIAL_OWNERSHIP_DECLARED",
                "Has beneficial ownership or equivalent corporate ownership information been declared?",
                true
        );

        repository.seedQuestion(
                caseId,
                "SANCTIONS_DECLARATION",
                "Has the supplier provided an acceptable sanctions and restricted-party declaration?",
                true
        );

        repository.seedQuestion(
                caseId,
                "CONFLICT_OF_INTEREST",
                "Has the supplier completed the conflict-of-interest declaration?",
                true
        );

        repository.seedQuestion(
                caseId,
                "BUSINESS_CONTINUITY",
                "Has the supplier demonstrated appropriate business-continuity capability for the expected engagement?",
                true
        );

        repository.seedQuestion(
                caseId,
                "ESG_DECLARATION",
                "Has the supplier provided relevant ESG or responsible-business declarations where applicable?",
                false
        );
    }

    private void seedEvidence(
            UUID caseId,
            SupplierOnboardingRiskTier riskTier
    ) {
        repository.seedEvidence(
                caseId,
                OnboardingEvidenceType.COMPANY_REGISTRATION,
                true
        );

        repository.seedEvidence(
                caseId,
                OnboardingEvidenceType.TAX_REGISTRATION,
                true
        );

        repository.seedEvidence(
                caseId,
                OnboardingEvidenceType.BANK_INFORMATION,
                true
        );

        repository.seedEvidence(
                caseId,
                OnboardingEvidenceType.COMPLIANCE_DECLARATION,
                true
        );

        repository.seedEvidence(
                caseId,
                OnboardingEvidenceType.INSURANCE,
                riskTier
                                == SupplierOnboardingRiskTier.HIGH
                        ||
                        riskTier
                                == SupplierOnboardingRiskTier.CRITICAL
        );
    }

    private String nextCaseNumber() {
        Long sequence =
                repository
                        .nextCaseSequence();

        return String.format(
                "ONB-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                sequence
        );
    }

    private SupplierOnboardingRepository.CaseRow requireCase(
            UUID caseId
    ) {
        SupplierOnboardingRepository.CaseRow onboardingCase =
                repository
                        .findCase(
                                caseId
                        );

        if (onboardingCase == null) {
            throw new ResourceNotFoundException(
                    "Supplier onboarding case not found: "
                            + caseId
            );
        }

        return onboardingCase;
    }

    private SupplierOnboardingRepository.CaseRow requireEditableCase(
            UUID caseId
    ) {
        SupplierOnboardingRepository.CaseRow onboardingCase =
                requireCase(
                        caseId
                );

        if (
                onboardingCase.status()
                        != SupplierOnboardingStatus.DRAFT
                &&
                onboardingCase.status()
                        != SupplierOnboardingStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "This onboarding case can no longer be edited."
            );
        }

        return onboardingCase;
    }

    private SupplierOnboardingRepository.EvidenceRow requireEvidence(
            UUID evidenceId
    ) {
        SupplierOnboardingRepository.EvidenceRow evidence =
                repository
                        .findEvidenceById(
                                evidenceId
                        );

        if (evidence == null) {
            throw new ResourceNotFoundException(
                    "Supplier onboarding evidence not found: "
                            + evidenceId
            );
        }

        return evidence;
    }

    private SupplierOnboardingRepository.ApprovalRow requireApproval(
            UUID approvalId
    ) {
        SupplierOnboardingRepository.ApprovalRow approval =
                repository
                        .findApproval(
                                approvalId
                        );

        if (approval == null) {
            throw new ResourceNotFoundException(
                    "Supplier onboarding approval not found: "
                            + approvalId
            );
        }

        return approval;
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

    private AppUserEntity requireGovernanceUser(
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
                    "Supplier onboarding ownership requires a procurement governance role."
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
                    "Your ProcureIQ role cannot access supplier onboarding."
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
                    "Your ProcureIQ role cannot manage supplier onboarding."
            );
        }
    }

    private void assertApprovalRole(
            ProcurementRole role,
            OnboardingApprovalLevel level
    ) {
        if (
                level
                        == OnboardingApprovalLevel.PROCUREMENT
        ) {
            if (
                    role != ProcurementRole.ADMIN
                    &&
                    role != ProcurementRole.PROCUREMENT_MANAGER
                    &&
                    role != ProcurementRole.APPROVER
            ) {
                throw new IllegalArgumentException(
                        "Your ProcureIQ role cannot approve procurement qualification."
                );
            }

            return;
        }

        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Compliance and risk qualification require administrator or procurement-manager approval."
            );
        }
    }

    private void assertFinalizationRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can grant supplier activation clearance."
            );
        }
    }
}
