package com.procureiq.interventionexecution;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/intervention-execution")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class InterventionExecutionController {

    private final InterventionExecutionService service;

    public InterventionExecutionController(
            InterventionExecutionService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public InterventionExecutionDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/interventions/{interventionCaseId}/cases")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public InterventionExecutionCaseDetailResponse createCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID interventionCaseId,

            @Valid
            @RequestBody
            InterventionExecutionCaseInput input
    ) {
        return service.createCase(
                currentUserId(
                        jwt
                ),
                interventionCaseId,
                input
        );
    }

    @GetMapping("/cases/{executionCaseId}")
    public InterventionExecutionCaseDetailResponse executionCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID executionCaseId
    ) {
        return service.executionCase(
                currentUserId(
                        jwt
                ),
                executionCaseId
        );
    }

    @PostMapping("/cases/{executionCaseId}/acknowledge")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public InterventionExecutionCaseDetailResponse acknowledge(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID executionCaseId,

            @Valid
            @RequestBody
            InterventionExecutionAcknowledgementInput input
    ) {
        return service.acknowledge(
                currentUserId(
                        jwt
                ),
                executionCaseId,
                input
        );
    }

    @PostMapping("/cases/{executionCaseId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public InterventionExecutionCaseDetailResponse startExecution(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID executionCaseId
    ) {
        return service.startExecution(
                currentUserId(
                        jwt
                ),
                executionCaseId
        );
    }

    @PostMapping("/cases/{executionCaseId}/evidence")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public InterventionExecutionCaseDetailResponse recordEvidence(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID executionCaseId,

            @Valid
            @RequestBody
            InterventionExecutionEvidenceInput input
    ) {
        return service.recordEvidence(
                currentUserId(
                        jwt
                ),
                executionCaseId,
                input
        );
    }

    @PostMapping("/cases/{executionCaseId}/ready-for-verification")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public InterventionExecutionCaseDetailResponse submitForVerification(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID executionCaseId
    ) {
        return service.submitForVerification(
                currentUserId(
                        jwt
                ),
                executionCaseId
        );
    }

    @PostMapping("/cases/{executionCaseId}/verify")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public InterventionExecutionCaseDetailResponse verifyExecution(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID executionCaseId,

            @Valid
            @RequestBody
            InterventionExecutionVerificationInput input
    ) {
        return service.verifyExecution(
                currentUserId(
                        jwt
                ),
                executionCaseId,
                input
        );
    }

    @PostMapping("/cases/{executionCaseId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public InterventionExecutionCaseDetailResponse closeCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID executionCaseId,

            @Valid
            @RequestBody
            InterventionExecutionNoteInput input
    ) {
        return service.closeCase(
                currentUserId(
                        jwt
                ),
                executionCaseId,
                input
        );
    }

    @PostMapping("/snapshots")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public InterventionExecutionSnapshotDetailResponse captureSnapshot(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.captureSnapshot(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/snapshots/{snapshotId}")
    public InterventionExecutionSnapshotDetailResponse snapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID snapshotId
    ) {
        return service.snapshot(
                currentUserId(
                        jwt
                ),
                snapshotId
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
