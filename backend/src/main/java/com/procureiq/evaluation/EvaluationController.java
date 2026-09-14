package com.procureiq.evaluation;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/rfqs")
public class EvaluationController {

    private final EvaluationWorkflowService
            evaluationWorkflowService;

    public EvaluationController(
            EvaluationWorkflowService evaluationWorkflowService
    ) {
        this.evaluationWorkflowService =
                evaluationWorkflowService;
    }

    @GetMapping("/{rfqId}/evaluation")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public RfqEvaluationResponse getEvaluation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID rfqId
    ) {
        return evaluationWorkflowService
                .getEvaluation(
                        currentUserId(jwt),
                        rfqId
                );
    }

    @PutMapping("/{rfqId}/evaluation")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public RfqEvaluationResponse calculate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID rfqId,

            @Valid
            @RequestBody
            RfqEvaluationInput input
    ) {
        return evaluationWorkflowService
                .calculate(
                        currentUserId(jwt),
                        rfqId,
                        input
                );
    }

    @GetMapping("/{rfqId}/award")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public AwardDecisionResponse findAward(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID rfqId
    ) {
        return evaluationWorkflowService
                .findAward(
                        currentUserId(jwt),
                        rfqId
                );
    }

    @PostMapping("/{rfqId}/award")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public AwardDecisionResponse award(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID rfqId,

            @Valid
            @RequestBody
            AwardDecisionInput input
    ) {
        return evaluationWorkflowService
                .award(
                        currentUserId(jwt),
                        rfqId,
                        input
                );
    }

    private UUID currentUserId(
            Jwt jwt
    ) {
        try {
            return UUID.fromString(
                    jwt.getSubject()
            );
        } catch (
                IllegalArgumentException exception
        ) {
            throw new IllegalArgumentException(
                    "Invalid authenticated ProcureIQ identity."
            );
        }
    }
}
