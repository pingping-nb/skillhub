package com.iflytek.skillhub.auth.ldap;

/**
 * Normalized result of a successful LDAP authentication.
 */
public record LdapUser(
    String uid,
    String username,
    String displayName,
    String email
) {}
