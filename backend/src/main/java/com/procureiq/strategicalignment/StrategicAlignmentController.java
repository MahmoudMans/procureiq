package com.procureiq.strategicalignment;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/v1/strategic-alignment")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class StrategicAlignmentController {

    private final StrategicAlignmentService service;

    public StrategicAlignmentController(
            StrategicAlignmentService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public StrategicAlignmentDashboardResponse dashboard(
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

    @GetMapping("/objectives/{objectiveId}")
    public ObjectiveAlignmentDetailResponse objective(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID objectiveId
    ) {
        return service.objective(
                currentUserId(
                        jwt
                ),
                objectiveId
        );
    }

    @PostMapping("/objectives/{objectiveId}/links")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public AlignmentLinkResponse createLink(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID objectiveId,

            @Valid
            @RequestBody
            StrategicAlignmentLinkInput input
    ) {
        return service.createLink(
                currentUserId(
                        jwt
                ),
                objectiveId,
                input
        );
    }

    @DeleteMapping("/links/{linkId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.NO_CONTENT
    )
    public void deleteLink(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID linkId
    ) {
        service.deleteLink(
                currentUserId(
                        jwt
                ),
                linkId
        );
    }

    @PostMapping("/reviews")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public AlignmentReviewDetailResponse captureReview(
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
        return service.captureReview(
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

    @GetMapping("/reviews/{reviewId}")
    public AlignmentReviewDetailResponse review(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID reviewId
    ) {
        return service.review(
                currentUserId(
                        jwt
                ),
                reviewId
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
