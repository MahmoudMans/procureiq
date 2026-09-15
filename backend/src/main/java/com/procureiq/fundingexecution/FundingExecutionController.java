package com.procureiq.fundingexecution;

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
@RequestMapping("/api/v1/funding-execution")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class FundingExecutionController {

    private final FundingExecutionService service;

    public FundingExecutionController(
            FundingExecutionService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public FundingExecutionDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/allocation-items/{allocationItemId}/commitments")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FundingCommitmentDetailResponse createCommitment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID allocationItemId,

            @Valid
            @RequestBody
            FundingCommitmentInput input
    ) {
        return service.createCommitment(
                currentUserId(
                        jwt
                ),
                allocationItemId,
                input
        );
    }

    @GetMapping("/commitments/{commitmentId}")
    public FundingCommitmentDetailResponse commitment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID commitmentId
    ) {
        return service.commitment(
                currentUserId(
                        jwt
                ),
                commitmentId
        );
    }

    @PostMapping("/commitments/{commitmentId}/tranches")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FundingCommitmentDetailResponse createTranche(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID commitmentId,

            @Valid
            @RequestBody
            FundingTrancheInput input
    ) {
        return service.createTranche(
                currentUserId(
                        jwt
                ),
                commitmentId,
                input
        );
    }

    @PostMapping("/tranches/{trancheId}/gates")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FundingCommitmentDetailResponse createGate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID trancheId,

            @Valid
            @RequestBody
            FundingGateInput input
    ) {
        return service.createGate(
                currentUserId(
                        jwt
                ),
                trancheId,
                input
        );
    }

    @PostMapping("/gates/{gateId}/decide")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FundingCommitmentDetailResponse decideGate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID gateId,

            @Valid
            @RequestBody
            FundingGateDecisionInput input
    ) {
        return service.decideGate(
                currentUserId(
                        jwt
                ),
                gateId,
                input
        );
    }

    @PostMapping("/commitments/{commitmentId}/activate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FundingCommitmentDetailResponse activateCommitment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID commitmentId,

            @Valid
            @RequestBody
            FundingNoteInput input
    ) {
        return service.activateCommitment(
                currentUserId(
                        jwt
                ),
                commitmentId,
                input
        );
    }

    @PostMapping("/tranches/{trancheId}/request-authorization")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public FundingCommitmentDetailResponse requestAuthorization(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID trancheId,

            @Valid
            @RequestBody
            FundingNoteInput input
    ) {
        return service.requestAuthorization(
                currentUserId(
                        jwt
                ),
                trancheId,
                input
        );
    }

    @PostMapping("/tranches/{trancheId}/authorize")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FundingCommitmentDetailResponse authorizeTranche(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID trancheId,

            @Valid
            @RequestBody
            FundingAuthorizationInput input
    ) {
        return service.authorizeTranche(
                currentUserId(
                        jwt
                ),
                trancheId,
                input
        );
    }

    @PostMapping("/tranches/{trancheId}/release")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FundingCommitmentDetailResponse releaseTranche(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID trancheId,

            @Valid
            @RequestBody
            FundingNoteInput input
    ) {
        return service.releaseTranche(
                currentUserId(
                        jwt
                ),
                trancheId,
                input
        );
    }

    @PostMapping("/commitments/{commitmentId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FundingCommitmentDetailResponse closeCommitment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID commitmentId,

            @Valid
            @RequestBody
            FundingNoteInput input
    ) {
        return service.closeCommitment(
                currentUserId(
                        jwt
                ),
                commitmentId,
                input
        );
    }

    @PostMapping("/commitments/{commitmentId}/snapshots")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FundingSnapshotDetailResponse captureSnapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID commitmentId
    ) {
        return service.captureSnapshot(
                currentUserId(
                        jwt
                ),
                commitmentId
        );
    }

    @GetMapping("/snapshots/{snapshotId}")
    public FundingSnapshotDetailResponse snapshot(
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
