package com.procureiq.quotation;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
)
public class QuotationController {

    private final QuotationService quotationService;

    public QuotationController(
            QuotationService quotationService
    ) {
        this.quotationService =
                quotationService;
    }

    @GetMapping(
            "/rfqs/{rfqId}/quotations"
    )
    public List<QuotationResponse>
    findRfqQuotations(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID rfqId
    ) {
        return quotationService
                .findRfqQuotations(
                        currentUserId(jwt),
                        rfqId
                );
    }

    @GetMapping(
            "/rfqs/{rfqId}/quotation-comparison"
    )
    public QuotationComparisonResponse
    compare(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID rfqId
    ) {
        return quotationService
                .compare(
                        currentUserId(jwt),
                        rfqId
                );
    }

    @PostMapping(
            "/rfqs/{rfqId}/quotations"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public QuotationResponse
    createQuotation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID rfqId,

            @Valid
            @RequestBody
            QuotationCreateInput input
    ) {
        return quotationService
                .createQuotation(
                        currentUserId(jwt),
                        rfqId,
                        input
                );
    }

    @PutMapping(
            "/quotations/{quotationId}"
    )
    public QuotationResponse
    updateQuotation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID quotationId,

            @Valid
            @RequestBody
            QuotationUpdateInput input
    ) {
        return quotationService
                .updateQuotation(
                        currentUserId(jwt),
                        quotationId,
                        input
                );
    }

    @PostMapping(
            "/quotations/{quotationId}/submit"
    )
    public QuotationResponse
    submitQuotation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID quotationId
    ) {
        return quotationService
                .submitQuotation(
                        currentUserId(jwt),
                        quotationId
                );
    }

    @PostMapping(
            "/quotations/{quotationId}/withdraw"
    )
    public QuotationResponse
    withdrawQuotation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID quotationId
    ) {
        return quotationService
                .withdrawQuotation(
                        currentUserId(jwt),
                        quotationId
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
