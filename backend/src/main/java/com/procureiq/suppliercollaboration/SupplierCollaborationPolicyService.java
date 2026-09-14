package com.procureiq.suppliercollaboration;

import org.springframework.stereotype.Component;

@Component
public class SupplierCollaborationPolicyService {

    public int defaultSupplierResponseSlaHours(
            CollaborationWorkspaceType workspaceType,
            CollaborationPriority priority
    ) {
        int baseHours =
                switch (
                        workspaceType
                ) {
                    case SOURCING_CLARIFICATION ->
                            48;

                    case PURCHASE_ORDER ->
                            24;

                    case DELIVERY ->
                            24;

                    case DOCUMENT_REQUEST ->
                            72;

                    case QUALITY_ISSUE ->
                            24;

                    case GENERAL ->
                            48;
                };

        return switch (
                priority
        ) {
            case LOW ->
                    Math.min(
                            720,
                            baseHours * 2
                    );

            case MEDIUM ->
                    baseHours;

            case HIGH ->
                    Math.max(
                            8,
                            baseHours / 2
                    );

            case CRITICAL ->
                    Math.max(
                            4,
                            baseHours / 4
                    );
        };
    }
}
