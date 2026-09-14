package com.procureiq.invoice;

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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/invoices")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class InvoiceController {

    private final InvoiceService service;

    public InvoiceController(
            InvoiceService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public List<ProcurementInvoiceResponse> invoices(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.invoices(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @GetMapping("/summary")
    public InvoiceSummaryResponse summary(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.summary(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @GetMapping("/context-options")
    public InvoiceContextResponse contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.contextOptions(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/{invoiceId}")
    public ProcurementInvoiceResponse invoice(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID invoiceId
    ) {
        return service.invoice(
                currentUserId(
                        jwt
                ),
                invoiceId
        );
    }

    @PostMapping
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ProcurementInvoiceResponse createInvoice(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            ProcurementInvoiceInput input
    ) {
        return service.createInvoice(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/{invoiceId}/match")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public InvoiceMatchResultResponse runMatch(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID invoiceId
    ) {
        return service.runMatch(
                currentUserId(
                        jwt
                ),
                invoiceId
        );
    }

    @PostMapping("/exceptions/{exceptionId}/resolve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public InvoiceMatchExceptionResponse resolveException(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID exceptionId,

            @Valid
            @RequestBody
            InvoiceDecisionInput input
    ) {
        return service.resolveException(
                currentUserId(
                        jwt
                ),
                exceptionId,
                input
        );
    }

    @PostMapping("/exceptions/{exceptionId}/dismiss")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','APPROVER')"
    )
    public InvoiceMatchExceptionResponse dismissException(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID exceptionId,

            @Valid
            @RequestBody
            InvoiceDecisionInput input
    ) {
        return service.dismissException(
                currentUserId(
                        jwt
                ),
                exceptionId,
                input
        );
    }

    @PostMapping("/{invoiceId}/approve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','APPROVER')"
    )
    public ProcurementInvoiceResponse approveInvoice(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID invoiceId
    ) {
        return service.approveInvoice(
                currentUserId(
                        jwt
                ),
                invoiceId
        );
    }

    @PostMapping("/{invoiceId}/hold")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ProcurementInvoiceResponse holdPayment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID invoiceId,

            @Valid
            @RequestBody
            InvoiceDecisionInput input
    ) {
        return service.holdPayment(
                currentUserId(
                        jwt
                ),
                invoiceId,
                input
        );
    }

    @PostMapping("/{invoiceId}/release-hold")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','APPROVER')"
    )
    public ProcurementInvoiceResponse releasePaymentHold(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID invoiceId
    ) {
        return service.releasePaymentHold(
                currentUserId(
                        jwt
                ),
                invoiceId
        );
    }

    @PostMapping("/{invoiceId}/ready-for-payment")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ProcurementInvoiceResponse markReadyForPayment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID invoiceId
    ) {
        return service.markReadyForPayment(
                currentUserId(
                        jwt
                ),
                invoiceId
        );
    }

    @PostMapping("/{invoiceId}/paid")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ProcurementInvoiceResponse markPaid(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID invoiceId
    ) {
        return service.markPaid(
                currentUserId(
                        jwt
                ),
                invoiceId
        );
    }

    @PostMapping("/{invoiceId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','APPROVER')"
    )
    public ProcurementInvoiceResponse cancelInvoice(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID invoiceId,

            @Valid
            @RequestBody
            InvoiceDecisionInput input
    ) {
        return service.cancelInvoice(
                currentUserId(
                        jwt
                ),
                invoiceId,
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
