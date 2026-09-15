package com.procureiq.successionplanning;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Year;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/succession-planning")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class SuccessionPlanningController {

    private final SuccessionPlanningService service;

    public SuccessionPlanningController(
            SuccessionPlanningService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public SuccessionPlanningDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency,

            @RequestParam(
                    required = false
            )
            Integer fiscalYear
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                ),
                currency,
                fiscalYear == null
                        ? Year.now()
                                .getValue()
                        : fiscalYear
        );
    }

    @PostMapping("/policies")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public SuccessionPolicyDetailResponse createPolicy(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency,

            @RequestParam(
                    required = false
            )
            Integer fiscalYear,

            @Valid
            @RequestBody
            CriticalCapabilityPolicyInput input
    ) {
        return service.createPolicy(
                currentUserId(
                        jwt
                ),
                currency,
                fiscalYear == null
                        ? Year.now()
                                .getValue()
                        : fiscalYear,
                input
        );
    }

    @GetMapping("/policies/{policyId}")
    public SuccessionPolicyDetailResponse policy(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID policyId
    ) {
        return service.policy(
                currentUserId(
                        jwt
                ),
                policyId
        );
    }

    @PostMapping("/policies/{policyId}/candidates")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public SuccessionCandidateResponse nominateCandidate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID policyId,

            @Valid
            @RequestBody
            SuccessionCandidateInput input
    ) {
        return service.nominateCandidate(
                currentUserId(
                        jwt
                ),
                policyId,
                input
        );
    }

    @PostMapping("/candidates/{candidateId}/develop")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SuccessionCandidateResponse startCandidateDevelopment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID candidateId
    ) {
        return service.startCandidateDevelopment(
                currentUserId(
                        jwt
                ),
                candidateId
        );
    }

    @PostMapping("/candidates/{candidateId}/ready")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SuccessionCandidateResponse markCandidateReady(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID candidateId,

            @Valid
            @RequestBody
            SuccessionNoteInput input
    ) {
        return service.markCandidateReady(
                currentUserId(
                        jwt
                ),
                candidateId,
                input
        );
    }

    @PostMapping("/candidates/{candidateId}/decline")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SuccessionCandidateResponse declineCandidate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID candidateId,

            @Valid
            @RequestBody
            SuccessionNoteInput input
    ) {
        return service.declineCandidate(
                currentUserId(
                        jwt
                ),
                candidateId,
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
    public SuccessionSnapshotDetailResponse captureSnapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency,

            @RequestParam(
                    required = false
            )
            Integer fiscalYear
    ) {
        return service.captureSnapshot(
                currentUserId(
                        jwt
                ),
                currency,
                fiscalYear == null
                        ? Year.now()
                                .getValue()
                        : fiscalYear
        );
    }

    @GetMapping("/snapshots/{snapshotId}")
    public SuccessionSnapshotDetailResponse snapshot(
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
