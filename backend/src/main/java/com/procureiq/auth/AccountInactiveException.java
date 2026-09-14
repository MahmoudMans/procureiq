package com.procureiq.auth;

public class AccountInactiveException
        extends RuntimeException {

    public AccountInactiveException() {
        super("This ProcureIQ account is inactive.");
    }
}
