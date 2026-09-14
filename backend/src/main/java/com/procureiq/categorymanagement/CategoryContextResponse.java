package com.procureiq.categorymanagement;

import java.util.List;

public record CategoryContextResponse(
        List<CategoryInsightResponse> categories,
        List<CategoryUserOptionResponse> users
) {
}
