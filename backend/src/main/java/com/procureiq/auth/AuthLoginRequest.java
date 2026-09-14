package com.procureiq.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AuthLoginRequest(

        @NotBlank
        @Email
        @Size(max = 200)
        String email,

        @NotBlank
        @Size(min = 8, max = 200)
        String password
) {
}
