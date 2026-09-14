package com.procureiq.demandconsolidation;

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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/demand-consolidation")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class DemandConsolidationController {

    private final DemandConsolidationService service;

    public DemandConsolidationController(
            DemandConsolidationService service
    ) {
        this.service =
                service;
    }

    @GetMapping("/candidates")
    public List<DemandConsolidationCandidateResponse> candidates(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.candidates(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/bundles")
    public List<DemandBundleResponse> bundles(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.bundles(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/bundles/{bundleId}")
    public DemandBundleResponse bundle(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID bundleId
    ) {
        return service.bundle(
                currentUserId(
                        jwt
                ),
                bundleId
        );
    }

    @PostMapping("/bundles")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public DemandBundleResponse createBundle(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            DemandBundleInput input
    ) {
        return service.createBundle(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/bundles/{bundleId}/submit")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public DemandBundleResponse submit(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID bundleId
    ) {
        return service.submit(
                currentUserId(
                        jwt
                ),
                bundleId
        );
    }

    @PostMapping("/bundles/{bundleId}/approve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public DemandBundleResponse approve(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID bundleId,

            @Valid
            @RequestBody
            DemandBundleDecisionInput input
    ) {
        return service.approve(
                currentUserId(
                        jwt
                ),
                bundleId,
                input
        );
    }

    @PostMapping("/bundles/{bundleId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public DemandBundleResponse cancel(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID bundleId,

            @Valid
            @RequestBody
            DemandBundleDecisionInput input
    ) {
        return service.cancel(
                currentUserId(
                        jwt
                ),
                bundleId,
                input
        );
    }

    @PostMapping("/bundles/{bundleId}/link-rfq")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public DemandBundleResponse linkRfq(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID bundleId,

            @Valid
            @RequestBody
            DemandBundleRfqLinkInput input
    ) {
        return service.linkRfq(
                currentUserId(
                        jwt
                ),
                bundleId,
                input
        );
    }

    @PostMapping("/bundles/{bundleId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public DemandBundleResponse close(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID bundleId
    ) {
        return service.close(
                currentUserId(
                        jwt
                ),
                bundleId
        );
    }

    @GetMapping("/summary")
    public DemandConsolidationSummaryResponse summary(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.summary(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/context-options")
    public DemandConsolidationContextResponse contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.contextOptions(
                currentUserId(
                        jwt
                )
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
