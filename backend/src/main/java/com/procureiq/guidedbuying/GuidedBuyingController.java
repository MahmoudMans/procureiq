package com.procureiq.guidedbuying;

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
@RequestMapping("/api/v1/guided-buying")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','REQUESTER','APPROVER')"
)
public class GuidedBuyingController {

    private final GuidedBuyingService service;

    public GuidedBuyingController(
            GuidedBuyingService service
    ) {
        this.service =
                service;
    }

    @GetMapping("/intakes")
    public List<GuidedBuyingIntakeResponse> intakes(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.intakes(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/intakes/{intakeId}")
    public GuidedBuyingIntakeResponse intake(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID intakeId
    ) {
        return service.intake(
                currentUserId(
                        jwt
                ),
                intakeId
        );
    }

    @PostMapping("/intakes")
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public GuidedBuyingIntakeResponse createIntake(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            GuidedBuyingIntakeInput input
    ) {
        return service.createIntake(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/recommend")
    public GuidedBuyingRecommendationResponse recommend(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            GuidedBuyingIntakeInput input
    ) {
        return service.recommend(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/intakes/{intakeId}/refresh-guidance")
    public GuidedBuyingIntakeResponse refreshGuidance(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID intakeId
    ) {
        return service.refreshGuidance(
                currentUserId(
                        jwt
                ),
                intakeId
        );
    }

    @PostMapping("/intakes/{intakeId}/ready")
    public GuidedBuyingIntakeResponse markReady(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID intakeId
    ) {
        return service.markReady(
                currentUserId(
                        jwt
                ),
                intakeId
        );
    }

    @PostMapping("/intakes/{intakeId}/link-request")
    public GuidedBuyingIntakeResponse linkRequest(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID intakeId,

            @Valid
            @RequestBody
            GuidedBuyingRequestLinkInput input
    ) {
        return service.linkRequest(
                currentUserId(
                        jwt
                ),
                intakeId,
                input
        );
    }

    @PostMapping("/intakes/{intakeId}/cancel")
    public GuidedBuyingIntakeResponse cancelIntake(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID intakeId
    ) {
        return service.cancelIntake(
                currentUserId(
                        jwt
                ),
                intakeId
        );
    }

    @GetMapping("/templates")
    public List<GuidedBuyingTemplateResponse> templates(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.templates(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/templates")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public GuidedBuyingTemplateResponse createTemplate(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            GuidedBuyingTemplateInput input
    ) {
        return service.createTemplate(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/templates/{templateId}/activate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public GuidedBuyingTemplateResponse activateTemplate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID templateId
    ) {
        return service.setTemplateActive(
                currentUserId(
                        jwt
                ),
                templateId,
                true
        );
    }

    @PostMapping("/templates/{templateId}/deactivate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public GuidedBuyingTemplateResponse deactivateTemplate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID templateId
    ) {
        return service.setTemplateActive(
                currentUserId(
                        jwt
                ),
                templateId,
                false
        );
    }

    @GetMapping("/preferred-suppliers")
    public List<PreferredSupplierResponse> preferredSuppliers(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.preferredSuppliers(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/preferred-suppliers")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public PreferredSupplierResponse createPreferredSupplier(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            PreferredSupplierInput input
    ) {
        return service.createPreferredSupplier(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/preferred-suppliers/{preferredSupplierId}/deactivate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public PreferredSupplierResponse deactivatePreferredSupplier(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID preferredSupplierId
    ) {
        return service.deactivatePreferredSupplier(
                currentUserId(
                        jwt
                ),
                preferredSupplierId
        );
    }

    @GetMapping("/summary")
    public GuidedBuyingSummaryResponse summary(
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
    public GuidedBuyingContextResponse contextOptions(
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
