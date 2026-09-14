package com.procureiq.controltower;

import java.util.List;

public record ControlTowerContextResponse(
        List<ControlTowerUserOptionResponse> users
) {
}
