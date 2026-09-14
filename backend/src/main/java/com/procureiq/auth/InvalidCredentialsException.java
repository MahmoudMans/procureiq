package com.procureiq.auth;

public class InvalidCredentialsException
        extends RuntimeException {

    public InvalidCredentialsException() {
        super("Invalid email or password.");
    }
}
