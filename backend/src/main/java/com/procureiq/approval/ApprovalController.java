package com.procureiq.approval;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/approvals")
public class ApprovalController {

    private final ApprovalWorkflowService
            approvalWorkflowService;

    public ApprovalController(
            ApprovalWorkflowService approvalWorkflowService
    ) {
        this.approvalWorkflowService =
                approvalWorkflowService;
    }

    @GetMapping
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','APPROVER')"
    )
    public List<ApprovalTaskResponse> findQueue(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            ApprovalTaskStatus status
    ) {
        return approvalWorkflowService
                .findQueue(
                        currentUserId(jwt),
                        status
                );
    }

    @GetMapping("/summary")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','APPROVER')"
    )
    public ApprovalSummaryResponse getSummary(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return approvalWorkflowService
                .getSummary(
                        currentUserId(jwt)
                );
    }

    @GetMapping("/by-request/{purchaseRequestId}")
    public List<ApprovalTaskResponse>
    findRequestHistory(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID purchaseRequestId
    ) {
        return approvalWorkflowService
                .findRequestHistory(
                        currentUserId(jwt),
                        purchaseRequestId
                );
    }

    @PostMapping("/{taskId}/approve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','APPROVER')"
    )
    public ApprovalTaskResponse approve(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID taskId,

            @Valid
            @RequestBody
            ApprovalDecisionInput input
    ) {
        return approvalWorkflowService
                .approve(
                        currentUserId(jwt),
                        taskId,
                        input
                );
    }

    @PostMapping("/{taskId}/reject")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','APPROVER')"
    )
    public ApprovalTaskResponse reject(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID taskId,

            @Valid
            @RequestBody
            ApprovalDecisionInput input
    ) {
        return approvalWorkflowService
                .reject(
                        currentUserId(jwt),
                        taskId,
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
