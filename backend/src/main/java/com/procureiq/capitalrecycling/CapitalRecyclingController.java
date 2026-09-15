package com.procureiq.capitalrecycling;

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
@RequestMapping("/api/v1/capital-recycling")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class CapitalRecyclingController {

    private final CapitalRecyclingService service;

    public CapitalRecyclingController(
            CapitalRecyclingService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public CapitalRecyclingDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/executions/{executionCaseId}/sources")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CapitalRecyclingSourceDetailResponse createSource(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID executionCaseId,

            @Valid
            @RequestBody
            CapitalRecyclingSourceInput input
    ) {
        return service.createSource(
                currentUserId(
                        jwt
                ),
                executionCaseId,
                input
        );
    }

    @GetMapping("/sources/{sourceId}")
    public CapitalRecyclingSourceDetailResponse source(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID sourceId
    ) {
        return service.source(
                currentUserId(
                        jwt
                ),
                sourceId
        );
    }

    @PostMapping("/sources/{sourceId}/proposals")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CapitalRecyclingSourceDetailResponse createProposal(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID sourceId,

            @Valid
            @RequestBody
            CapitalReinvestmentProposalInput input
    ) {
        return service.createProposal(
                currentUserId(
                        jwt
                ),
                sourceId,
                input
        );
    }

    @PostMapping("/proposals/{proposalId}/decide")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public CapitalRecyclingSourceDetailResponse decideProposal(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID proposalId,

            @Valid
            @RequestBody
            CapitalReinvestmentDecisionInput input
    ) {
        return service.decideProposal(
                currentUserId(
                        jwt
                ),
                proposalId,
                input
        );
    }

    @PostMapping("/sources/{sourceId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public CapitalRecyclingSourceDetailResponse closeSource(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID sourceId,

            @Valid
            @RequestBody
            CapitalRecyclingNoteInput input
    ) {
        return service.closeSource(
                currentUserId(
                        jwt
                ),
                sourceId,
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
    public CapitalRecyclingSnapshotDetailResponse captureSnapshot(
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
    public CapitalRecyclingSnapshotDetailResponse snapshot(
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
