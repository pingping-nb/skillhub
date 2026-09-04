package com.iflytek.skillhub.auth.ldap;

import com.iflytek.skillhub.auth.direct.DirectAuthProvider;
import com.iflytek.skillhub.auth.direct.DirectAuthRequest;
import com.iflytek.skillhub.auth.rbac.PlatformPrincipal;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Direct-auth provider that verifies username/password credentials against an
 * LDAP directory and maps the authenticated identity to a platform user.
 *
 * <p>Registered only when {@code skillhub.auth.ldap.enabled=true}.
 */
@Component
@ConditionalOnProperty(name = "skillhub.auth.ldap.enabled", havingValue = "true")
public class LdapDirectAuthProvider implements DirectAuthProvider {

    private final LdapClient ldapClient;
    private final LdapIdentityService ldapIdentityService;

    public LdapDirectAuthProvider(LdapClient ldapClient,
                                  LdapIdentityService ldapIdentityService) {
        this.ldapClient = ldapClient;
        this.ldapIdentityService = ldapIdentityService;
    }

    @Override
    public String providerCode() {
        return LdapIdentityService.PROVIDER_CODE;
    }

    @Override
    public String displayName() {
        return "LDAP";
    }

    @Override
    public PlatformPrincipal authenticate(DirectAuthRequest request) {
        LdapUser ldapUser = ldapClient.authenticate(request.username(), request.password());
        return ldapIdentityService.resolveOrCreate(ldapUser);
    }
}
