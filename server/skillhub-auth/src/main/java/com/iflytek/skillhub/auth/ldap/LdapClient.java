package com.iflytek.skillhub.auth.ldap;

import com.iflytek.skillhub.auth.exception.AuthFlowException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.ldap.core.ContextMapper;
import org.springframework.ldap.core.DirContextOperations;
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.core.support.LdapContextSource;
import org.springframework.ldap.filter.HardcodedFilter;
import org.springframework.ldap.query.LdapQueryBuilder;
import org.springframework.stereotype.Component;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.List;
import java.util.UUID;

/**
 * Encapsulates LDAP connection, search, and bind logic for the LDAP
 * direct-auth provider.
 *
 * <p>The underlying {@link LdapTemplate} is built lazily so that the OSS build
 * does not require a reachable LDAP server unless the provider is enabled.
 */
@Component
public class LdapClient {

    private static final Logger log = LoggerFactory.getLogger(LdapClient.class);

    private final LdapProperties properties;
    private volatile LdapTemplate ldapTemplate;

    public LdapClient(LdapProperties properties) {
        this.properties = properties;
    }

    private LdapTemplate template() {
        LdapTemplate local = ldapTemplate;
        if (local == null) {
            synchronized (this) {
                local = ldapTemplate;
                if (local == null) {
                    local = buildTemplate(properties);
                    ldapTemplate = local;
                }
            }
        }
        return local;
    }

    private static LdapTemplate buildTemplate(LdapProperties properties) {
        LdapContextSource contextSource = new LdapContextSource();
        contextSource.setUrl(resolveUrl(properties));
        contextSource.setBase(properties.getBaseDn());
        if (properties.getBindDn() != null && !properties.getBindDn().isBlank()) {
            contextSource.setUserDn(properties.getBindDn());
            contextSource.setPassword(properties.getBindPassword());
        }
        java.util.Map<String, Object> baseEnv = new java.util.HashMap<>();
        baseEnv.put("java.naming.referral", "follow");
        if (isTlsEnabled(properties) && !properties.isValidateCert()) {
            baseEnv.put("java.naming.ldap.factory.socket", TrustAllSocketFactory.class.getName());
        }
        contextSource.setBaseEnvironmentProperties(baseEnv);
        contextSource.afterPropertiesSet();
        return new LdapTemplate(contextSource);
    }

    /**
     * Determines whether the connection uses TLS/SSL, in which case the
     * trust-all socket factory is relevant.
     */
    private static boolean isTlsEnabled(LdapProperties properties) {
        String url = properties.getUrl();
        return properties.isUseTls() || (url != null && url.startsWith("ldaps://"));
    }

    /**
     * Resolves the effective connection URL, promoting {@code ldap://} to
     * {@code ldaps://} when StartTLS is requested.
     */
    private static String resolveUrl(LdapProperties properties) {
        String url = properties.getUrl();
        if (url == null || url.isBlank()) {
            return url;
        }
        if (properties.isUseTls() && url.startsWith("ldap://")) {
            return "ldaps://" + url.substring("ldap://".length());
        }
        return url;
    }

    /**
     * Authenticates a username/password pair against LDAP and returns the
     * normalized user attributes on success.
     *
     * @throws AuthFlowException with {@code 401} when credentials are invalid
     *                           or the user cannot be found.
     */
    public LdapUser authenticate(String username, String password) {
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            throw new AuthFlowException(HttpStatus.UNAUTHORIZED, "error.auth.ldap.invalidCredentials");
        }

        DirContextOperations userEntry;
        try {
            userEntry = findUserEntry(username);
        } catch (AuthFlowException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("LDAP search failed for user '{}': {}", username, ex.getMessage());
            throw new AuthFlowException(HttpStatus.UNAUTHORIZED, "error.auth.ldap.invalidCredentials");
        }

        if (userEntry == null) {
            log.warn("LDAP user not found for username '{}'", username);
            throw new AuthFlowException(HttpStatus.UNAUTHORIZED, "error.auth.ldap.invalidCredentials");
        }

        String userDn = userEntry.getNameInNamespace();

        // Re-bind as the user to verify the password.
        try {
            LdapContextSource userContext = new LdapContextSource();
            userContext.setUrl(resolveUrl(properties));
            userContext.setBase(properties.getBaseDn());
            userContext.setUserDn(userDn);
            userContext.setPassword(password);
            java.util.Map<String, Object> userEnv = new java.util.HashMap<>();
            userEnv.put("java.naming.referral", "follow");
            if (isTlsEnabled(properties) && !properties.isValidateCert()) {
                userEnv.put("java.naming.ldap.factory.socket", TrustAllSocketFactory.class.getName());
            }
            userContext.setBaseEnvironmentProperties(userEnv);
            userContext.afterPropertiesSet();
            userContext.getContext(userDn, password);
        } catch (Exception ex) {
            log.warn("LDAP bind failed for DN '{}': {}", userDn, ex.getMessage());
            throw new AuthFlowException(HttpStatus.UNAUTHORIZED, "error.auth.ldap.invalidCredentials");
        }

        return buildLdapUser(userEntry, userDn, username);
    }

    private DirContextOperations findUserEntry(String username) {
        String filter = buildSearchFilter(username);
        List<DirContextOperations> entries = template().search(
            LdapQueryBuilder.query().filter(new HardcodedFilter(filter)),
            (ContextMapper<DirContextOperations>) ctx -> (DirContextOperations) ctx
        );
        return entries.stream().findFirst().orElse(null);
    }

    private LdapUser buildLdapUser(DirContextOperations entry, String userDn, String username) {
        String uid = readAttribute(entry, properties.getUidAttribute());
        String displayName = readAttribute(entry, properties.getDisplayNameAttribute());
        String email = readAttribute(entry, properties.getEmailAttribute());

        // Fall back to the DN or username when the UID attribute is absent.
        if (uid == null || uid.isBlank()) {
            uid = userDn;
        }
        if (displayName == null || displayName.isBlank()) {
            displayName = username;
        }

        return new LdapUser(uid, username, displayName, email);
    }

    private String readAttribute(DirContextOperations entry, String attributeName) {
        if (attributeName == null || attributeName.isBlank()) {
            return null;
        }
        try {
            Object value = entry.getObjectAttribute(attributeName);
            if (value == null) {
                return null;
            }
            if (value instanceof byte[] bytes) {
                return decodeBinaryAttribute(attributeName, bytes);
            }
            return value.toString();
        } catch (Exception ex) {
            return null;
        }
    }

    private String buildSearchFilter(String username) {
        String template = properties.getUserSearchFilter();
        if (template == null || template.isBlank()) {
            template = "(uid={0})";
        }
        // Escape the username to prevent LDAP filter injection.
        String escaped = escapeFilterValue(username);
        return template.replace("{0}", escaped);
    }

    String escapeFilterValue(String value) {
        StringBuilder sb = new StringBuilder();
        for (char c : value.toCharArray()) {
            switch (c) {
                case '\\' -> sb.append("\\5c");
                case '*' -> sb.append("\\2a");
                case '(' -> sb.append("\\28");
                case ')' -> sb.append("\\29");
                case '\0' -> sb.append("\\00");
                default -> sb.append(c);
            }
        }
        return sb.toString();
    }

    /**
     * Decodes binary LDAP attributes into a stable, readable string form.
     * Active Directory stores {@code objectGUID} and {@code objectSid} as
     * binary values that must be converted before use as an identity subject.
     */
    private String decodeBinaryAttribute(String attributeName, byte[] bytes) {
        String lower = attributeName.toLowerCase();
        if (lower.contains("objectguid")) {
            return decodeObjectGuid(bytes);
        }
        if (lower.contains("objectsid")) {
            return decodeObjectSid(bytes);
        }
        // Generic fallback: hex-encode the raw bytes.
        return hexEncode(bytes);
    }

    /**
     * Converts an Active Directory {@code objectGUID} (16-byte little-endian
     * GUID) into the canonical dashed UUID string form.
     */
    String decodeObjectGuid(byte[] bytes) {
        if (bytes.length != 16) {
            return hexEncode(bytes);
        }
        ByteBuffer buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        long mostSigBits = buffer.getLong();
        long leastSigBits = buffer.getLong();
        return new UUID(mostSigBits, leastSigBits).toString();
    }

    /**
     * Converts an Active Directory {@code objectSid} binary value into the
     * canonical {@code S-1-5-...} string form.
     */
    String decodeObjectSid(byte[] bytes) {
        if (bytes.length < 8) {
            return hexEncode(bytes);
        }
        int revision = bytes[0] & 0xFF;
        int subAuthorityCount = bytes[1] & 0xFF;
        if (bytes.length < 8 + subAuthorityCount * 4) {
            return hexEncode(bytes);
        }
        StringBuilder sid = new StringBuilder("S-").append(revision).append('-');
        long identifierAuthority = 0;
        for (int i = 2; i < 8; i++) {
            identifierAuthority = (identifierAuthority << 8) | (bytes[i] & 0xFF);
        }
        sid.append(identifierAuthority);
        for (int i = 0; i < subAuthorityCount; i++) {
            int offset = 8 + i * 4;
            long subAuthority = ((long) (bytes[offset] & 0xFF))
                | ((long) (bytes[offset + 1] & 0xFF) << 8)
                | ((long) (bytes[offset + 2] & 0xFF) << 16)
                | ((long) (bytes[offset + 3] & 0xFF) << 24);
            sid.append('-').append(subAuthority);
        }
        return sid.toString();
    }

    private String hexEncode(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
