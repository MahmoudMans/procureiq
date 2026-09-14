package com.procureiq.evaluation;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.quotation.QuotationEntity;
import com.procureiq.quotation.QuotationRepository;
import com.procureiq.quotation.QuotationStatus;
import com.procureiq.rfq.RfqEntity;
import com.procureiq.rfq.RfqRepository;
import com.procureiq.rfq.RfqStatus;
import com.procureiq.supplier.SupplierEntity;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class EvaluationWorkflowService {

    private static final BigDecimal HUNDRED =
            new BigDecimal("100.00");

    private static final BigDecimal DEFAULT_PRICE_WEIGHT =
            new BigDecimal("40.00");

    private static final BigDecimal DEFAULT_DELIVERY_WEIGHT =
            new BigDecimal("20.00");

    private static final BigDecimal DEFAULT_RATING_WEIGHT =
            new BigDecimal("15.00");

    private static final BigDecimal DEFAULT_RISK_WEIGHT =
            new BigDecimal("10.00");

    private static final BigDecimal DEFAULT_QUALITY_WEIGHT =
            new BigDecimal("15.00");

    private final RfqRepository rfqRepository;

    private final QuotationRepository
            quotationRepository;

    private final AppUserRepository
            appUserRepository;

    private final RfqEvaluationWeightsRepository
            weightsRepository;

    private final SupplierEvaluationRepository
            evaluationRepository;

    private final AwardDecisionRepository
            awardDecisionRepository;

    private final EvaluationScoringService
            scoringService;

    public EvaluationWorkflowService(
            RfqRepository rfqRepository,
            QuotationRepository quotationRepository,
            AppUserRepository appUserRepository,
            RfqEvaluationWeightsRepository weightsRepository,
            SupplierEvaluationRepository evaluationRepository,
            AwardDecisionRepository awardDecisionRepository,
            EvaluationScoringService scoringService
    ) {
        this.rfqRepository =
                rfqRepository;

        this.quotationRepository =
                quotationRepository;

        this.appUserRepository =
                appUserRepository;

        this.weightsRepository =
                weightsRepository;

        this.evaluationRepository =
                evaluationRepository;

        this.awardDecisionRepository =
                awardDecisionRepository;

        this.scoringService =
                scoringService;
    }

    @Transactional(readOnly = true)
    public RfqEvaluationResponse getEvaluation(
            UUID currentUserId,
            UUID rfqId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        RfqEntity rfq =
                findRfq(
                        rfqId
                );

        RfqEvaluationWeightsEntity weights =
                weightsRepository
                        .findByRfq_Id(
                                rfqId
                        )
                        .orElse(null);

        List<SupplierEvaluationEntity> evaluations =
                evaluationRepository
                        .findAllByRfq_IdOrderByRankPositionAsc(
                                rfqId
                        );

        if (weights == null) {
            return buildResponse(
                    rfq,
                    DEFAULT_PRICE_WEIGHT,
                    DEFAULT_DELIVERY_WEIGHT,
                    DEFAULT_RATING_WEIGHT,
                    DEFAULT_RISK_WEIGHT,
                    DEFAULT_QUALITY_WEIGHT,
                    evaluations
            );
        }

        return buildResponse(
                rfq,
                weights.getPriceWeight(),
                weights.getDeliveryWeight(),
                weights.getSupplierRatingWeight(),
                weights.getRiskWeight(),
                weights.getQualityWeight(),
                evaluations
        );
    }

    public RfqEvaluationResponse calculate(
            UUID currentUserId,
            UUID rfqId,
            RfqEvaluationInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        RfqEntity rfq =
                findRfq(
                        rfqId
                );

        if (
                rfq.getStatus()
                        != RfqStatus.PUBLISHED
                &&
                rfq.getStatus()
                        != RfqStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Supplier evaluation is available only for published or closed RFQs."
            );
        }

        validateWeights(input);

        List<QuotationEntity> quotations =
                submittedQuotations(
                        rfqId
                );

        if (quotations.size() < 2) {
            throw new IllegalArgumentException(
                    "At least two submitted quotations are required for supplier evaluation."
            );
        }

        Map<UUID, BigDecimal> qualityScores =
                qualityScoreMap(
                        quotations,
                        input.qualityScores()
                );

        BigDecimal lowestTotal =
                quotations.stream()
                        .map(
                                QuotationEntity::
                                        getTotalAmount
                        )
                        .min(
                                Comparator.naturalOrder()
                        )
                        .orElseThrow();

        int fastestLeadTime =
                quotations.stream()
                        .mapToInt(
                                QuotationEntity::
                                        getLeadTimeDays
                        )
                        .min()
                        .orElseThrow();

        RfqEvaluationWeightsEntity weights =
                weightsRepository
                        .findByRfq_Id(
                                rfqId
                        )
                        .orElseGet(
                                RfqEvaluationWeightsEntity::new
                        );

        weights.setRfq(rfq);

        weights.setPriceWeight(
                normalize(
                        input.priceWeight()
                )
        );

        weights.setDeliveryWeight(
                normalize(
                        input.deliveryWeight()
                )
        );

        weights.setSupplierRatingWeight(
                normalize(
                        input.supplierRatingWeight()
                )
        );

        weights.setRiskWeight(
                normalize(
                        input.riskWeight()
                )
        );

        weights.setQualityWeight(
                normalize(
                        input.qualityWeight()
                )
        );

        weights =
                weightsRepository
                        .save(weights);

        evaluationRepository
                .deleteAllByRfq_Id(
                        rfqId
                );

        List<SupplierEvaluationEntity> calculated =
                new ArrayList<>();

        for (
                QuotationEntity quotation
                : quotations
        ) {
            SupplierEntity supplier =
                    quotation.getSupplier();

            BigDecimal priceScore =
                    scoringService
                            .priceScore(
                                    lowestTotal,
                                    quotation.getTotalAmount()
                            );

            BigDecimal deliveryScore =
                    scoringService
                            .deliveryScore(
                                    fastestLeadTime,
                                    quotation.getLeadTimeDays()
                            );

            BigDecimal ratingScore =
                    scoringService
                            .supplierRatingScore(
                                    supplier.getRating()
                            );

            BigDecimal riskScore =
                    scoringService
                            .riskScore(
                                    supplier.getRiskLevel()
                            );

            BigDecimal qualityScore =
                    qualityScores.get(
                            quotation.getId()
                    );

            BigDecimal weightedTotal =
                    scoringService
                            .weightedTotal(
                                    priceScore,
                                    deliveryScore,
                                    ratingScore,
                                    riskScore,
                                    qualityScore,
                                    weights.getPriceWeight(),
                                    weights.getDeliveryWeight(),
                                    weights.getSupplierRatingWeight(),
                                    weights.getRiskWeight(),
                                    weights.getQualityWeight()
                            );

            SupplierEvaluationEntity evaluation =
                    new SupplierEvaluationEntity();

            evaluation.setRfq(rfq);

            evaluation.setQuotation(
                    quotation
            );

            evaluation.setPriceScore(
                    priceScore
            );

            evaluation.setDeliveryScore(
                    deliveryScore
            );

            evaluation.setSupplierRatingScore(
                    ratingScore
            );

            evaluation.setRiskScore(
                    riskScore
            );

            evaluation.setQualityScore(
                    qualityScore
            );

            evaluation.setWeightedTotalScore(
                    weightedTotal
            );

            calculated.add(
                    evaluation
            );
        }

        calculated.sort(
                Comparator
                        .comparing(
                                SupplierEvaluationEntity::
                                        getWeightedTotalScore
                        )
                        .reversed()
                        .thenComparing(
                                evaluation ->
                                        evaluation.getQuotation()
                                                .getTotalAmount()
                        )
        );

        for (
                int index = 0;
                index < calculated.size();
                index++
        ) {
            SupplierEvaluationEntity evaluation =
                    calculated.get(index);

            evaluation.setRankPosition(
                    index + 1
            );

            evaluation.setRecommended(
                    index == 0
            );
        }

        List<SupplierEvaluationEntity> saved =
                evaluationRepository
                        .saveAll(
                                calculated
                        );

        return buildResponse(
                rfq,
                weights.getPriceWeight(),
                weights.getDeliveryWeight(),
                weights.getSupplierRatingWeight(),
                weights.getRiskWeight(),
                weights.getQualityWeight(),
                saved.stream()
                        .sorted(
                                Comparator.comparingInt(
                                        SupplierEvaluationEntity::
                                                getRankPosition
                                )
                        )
                        .toList()
        );
    }

    @Transactional(readOnly = true)
    public AwardDecisionResponse findAward(
            UUID currentUserId,
            UUID rfqId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        findRfq(rfqId);

        AwardDecisionEntity decision =
                awardDecisionRepository
                        .findByRfq_Id(
                                rfqId
                        )
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NO_CONTENT
                                        )
                        );

        return toAwardResponse(
                decision
        );
    }

    public AwardDecisionResponse award(
            UUID currentUserId,
            UUID rfqId,
            AwardDecisionInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertAwardRole(
                user.getRole()
        );

        RfqEntity rfq =
                findRfq(
                        rfqId
                );

        if (
                rfq.getStatus()
                        != RfqStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "An RFQ must be closed before an award decision can be recorded."
            );
        }

        if (
                awardDecisionRepository
                        .existsByRfq_Id(
                                rfqId
                        )
        ) {
            throw new IllegalArgumentException(
                    "An award decision already exists for this RFQ."
            );
        }

        List<SupplierEvaluationEntity> evaluations =
                evaluationRepository
                        .findAllByRfq_IdOrderByRankPositionAsc(
                                rfqId
                        );

        if (evaluations.isEmpty()) {
            throw new IllegalArgumentException(
                    "Supplier evaluation must be completed before award."
            );
        }

        SupplierEvaluationEntity recommended =
                evaluations.stream()
                        .filter(
                                SupplierEvaluationEntity::
                                        isRecommended
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "No recommended supplier exists for this RFQ."
                                        )
                        );

        QuotationEntity selected =
                quotationRepository
                        .findById(
                                input.selectedQuotationId()
                        )
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Selected quotation not found: "
                                                        + input.selectedQuotationId()
                                        )
                        );

        if (
                !selected.getRfq()
                        .getId()
                        .equals(
                                rfqId
                        )
                ||
                selected.getStatus()
                        != QuotationStatus.SUBMITTED
        ) {
            throw new IllegalArgumentException(
                    "Award selection must reference a submitted quotation from this RFQ."
            );
        }

        boolean evaluated =
                evaluations.stream()
                        .anyMatch(
                                evaluation ->
                                        evaluation.getQuotation()
                                                .getId()
                                                .equals(
                                                        selected.getId()
                                                )
                        );

        if (!evaluated) {
            throw new IllegalArgumentException(
                    "Selected quotation is not part of the current supplier evaluation."
            );
        }

        String rationale =
                normalizeRequired(
                        input.rationale()
                );

        boolean override =
                !selected.getId()
                        .equals(
                                recommended
                                        .getQuotation()
                                        .getId()
                        );

        AwardDecisionEntity decision =
                new AwardDecisionEntity();

        decision.setRfq(rfq);

        decision.setSelectedQuotation(
                selected
        );

        decision.setRecommendedQuotation(
                recommended.getQuotation()
        );

        decision.setManualOverride(
                override
        );

        decision.setRationale(
                rationale
        );

        decision.setDecidedBy(
                user
        );

        rfq.setStatus(
                RfqStatus.AWARDED
        );

        rfqRepository.save(rfq);

        return toAwardResponse(
                awardDecisionRepository
                        .save(
                                decision
                        )
        );
    }

    private Map<UUID, BigDecimal>
    qualityScoreMap(
            List<QuotationEntity> quotations,
            List<SupplierQualityScoreInput> scores
    ) {
        if (
                scores.size()
                        != quotations.size()
        ) {
            throw new IllegalArgumentException(
                    "A quality score is required for every submitted quotation."
            );
        }

        Set<UUID> quotationIds =
                quotations.stream()
                        .map(
                                QuotationEntity::
                                        getId
                        )
                        .collect(
                                java.util.stream.Collectors
                                        .toSet()
                        );

        Map<UUID, BigDecimal> result =
                new HashMap<>();

        Set<UUID> seen =
                new HashSet<>();

        for (
                SupplierQualityScoreInput input
                : scores
        ) {
            if (
                    !quotationIds.contains(
                            input.quotationId()
                    )
            ) {
                throw new IllegalArgumentException(
                        "Quality score references a quotation outside this RFQ evaluation."
                );
            }

            if (
                    !seen.add(
                            input.quotationId()
                    )
            ) {
                throw new IllegalArgumentException(
                        "Duplicate quality score found for a quotation."
                );
            }

            result.put(
                    input.quotationId(),
                    normalize(
                            input.qualityScore()
                    )
            );
        }

        return result;
    }

    private void validateWeights(
            RfqEvaluationInput input
    ) {
        BigDecimal sum =
                input.priceWeight()
                        .add(
                                input.deliveryWeight()
                        )
                        .add(
                                input.supplierRatingWeight()
                        )
                        .add(
                                input.riskWeight()
                        )
                        .add(
                                input.qualityWeight()
                        );

        if (
                sum.compareTo(
                        HUNDRED
                ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Evaluation weights must total exactly 100."
            );
        }
    }

    private List<QuotationEntity>
    submittedQuotations(
            UUID rfqId
    ) {
        return quotationRepository
                .findAllByRfq_IdOrderByTotalAmountAsc(
                        rfqId
                )
                .stream()
                .filter(
                        quotation ->
                                quotation.getStatus()
                                        == QuotationStatus.SUBMITTED
                )
                .toList();
    }

    private RfqEvaluationResponse buildResponse(
            RfqEntity rfq,
            BigDecimal priceWeight,
            BigDecimal deliveryWeight,
            BigDecimal supplierRatingWeight,
            BigDecimal riskWeight,
            BigDecimal qualityWeight,
            List<SupplierEvaluationEntity> evaluations
    ) {
        List<SupplierEvaluationResponse> scorecards =
                evaluations.stream()
                        .sorted(
                                Comparator.comparingInt(
                                        SupplierEvaluationEntity::
                                                getRankPosition
                                )
                        )
                        .map(
                                this::toEvaluationResponse
                        )
                        .toList();

        SupplierEvaluationEntity recommended =
                evaluations.stream()
                        .filter(
                                SupplierEvaluationEntity::
                                        isRecommended
                        )
                        .findFirst()
                        .orElse(null);

        return new RfqEvaluationResponse(
                rfq.getId(),
                rfq.getRfqNumber(),
                priceWeight,
                deliveryWeight,
                supplierRatingWeight,
                riskWeight,
                qualityWeight,
                recommended == null
                        ? null
                        : recommended.getQuotation()
                                .getId(),
                recommended == null
                        ? null
                        : recommended.getQuotation()
                                .getSupplier()
                                .getLegalName(),
                scorecards.size(),
                scorecards
        );
    }

    private SupplierEvaluationResponse
    toEvaluationResponse(
            SupplierEvaluationEntity evaluation
    ) {
        QuotationEntity quotation =
                evaluation.getQuotation();

        SupplierEntity supplier =
                quotation.getSupplier();

        return new SupplierEvaluationResponse(
                evaluation.getId(),
                quotation.getId(),
                quotation.getQuotationNumber(),
                supplier.getId(),
                supplier.getLegalName(),
                quotation.getTotalAmount(),
                quotation.getLeadTimeDays(),
                supplier.getRating(),
                supplier.getRiskLevel(),
                evaluation.getPriceScore(),
                evaluation.getDeliveryScore(),
                evaluation.getSupplierRatingScore(),
                evaluation.getRiskScore(),
                evaluation.getQualityScore(),
                evaluation.getWeightedTotalScore(),
                evaluation.getRankPosition(),
                evaluation.isRecommended()
        );
    }

    private AwardDecisionResponse
    toAwardResponse(
            AwardDecisionEntity decision
    ) {
        QuotationEntity selected =
                decision.getSelectedQuotation();

        QuotationEntity recommended =
                decision.getRecommendedQuotation();

        return new AwardDecisionResponse(
                decision.getId(),
                decision.getRfq()
                        .getId(),
                decision.getRfq()
                        .getRfqNumber(),
                selected.getId(),
                selected.getQuotationNumber(),
                selected.getSupplier()
                        .getId(),
                selected.getSupplier()
                        .getLegalName(),
                selected.getTotalAmount(),
                recommended.getId(),
                recommended.getSupplier()
                        .getLegalName(),
                decision.isManualOverride(),
                decision.getRationale(),
                decision.getDecidedBy()
                        .getId(),
                decision.getDecidedBy()
                        .getFullName(),
                decision.getDecidedAt()
        );
    }

    private RfqEntity findRfq(
            UUID rfqId
    ) {
        return rfqRepository
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

    private void assertSourcingRole(
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
                    "Your ProcureIQ role cannot evaluate sourcing events."
            );
        }
    }

    private void assertAwardRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can record award decisions."
            );
        }
    }

    private BigDecimal normalize(
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
}
