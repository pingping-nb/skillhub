package com.iflytek.skillhub.auth.ldap;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration for the LDAP direct-auth provider.
 *
 * <p>All values are optional and default to empty/disabled so that the OSS
 * build remains unchanged unless an operator explicitly enables LDAP.
 */
@Component
@ConfigurationProperties(prefix = "skillhub.auth.ldap")
public class LdapProperties {

    /**
     * Master switch for the LDAP direct-auth provider. Defaults to false so the
     * OSS build is unaffected.
     */
    private boolean enabled = false;

    /**
     * LDAP server URL, e.g. {@code ldap://ldap.example.com:389} or
     * {@code ldaps://ldap.example.com:636}.
     */
    private String url = "";

    /**
     * Base DN used for user searches, e.g. {@code ou=people,dc=example,dc=com}.
     */
    private String baseDn = "";

    /**
     * Optional bind DN for a service account used to search for the user entry.
     * When empty, an anonymous bind is attempted.
     */
    private String bindDn = "";

    /**
     * Optional bind password for the service account.
     */
    private String bindPassword = "";

    /**
     * LDAP search filter template used to locate the user entry. The literal
     * {@code {0}} placeholder is replaced with the login username.
     *
     * <p>Examples:
     * <ul>
     *   <li>OpenLDAP: {@code (uid={0})}</li>
     *   <li>Active Directory: {@code (&(sAMAccountName={0})(!(userAccountControl:1.2.840.113556.1.4.803:=2)))}</li>
     * </ul>
     */
    private String userSearchFilter = "(uid={0})";

    /**
     * LDAP attribute that holds the display name, e.g. {@code cn} or
     * {@code displayName}. Defaults to {@code cn}.
     */
    private String displayNameAttribute = "cn";

    /**
     * LDAP attribute that holds the email address, e.g. {@code mail}.
     * Defaults to {@code mail}.
     */
    private String emailAttribute = "mail";

    /**
     * LDAP attribute that holds the stable unique identifier, e.g.
     * {@code entryUUID} (OpenLDAP) or {@code objectGUID} (Active Directory).
     * Defaults to {@code entryUUID}. Binary attributes such as
     * {@code objectGUID} and {@code objectSid} are converted to a readable
     * string form.
     */
    private String uidAttribute = "entryUUID";

    /**
     * Whether to use StartTLS on a plain LDAP connection. Ignored when the URL
     * already uses {@code ldaps://}.
     */
    private boolean useTls = false;

    /**
     * Whether to validate the server certificate for TLS/SSL connections.
     * Defaults to true. Set to false only for trusted internal directories.
     */
    private boolean validateCert = true;

    /**
     * Connect timeout in milliseconds.
     */
    private int connectTimeoutMillis = 5000;

    /**
     * Read timeout in milliseconds.
     */
    private int readTimeoutMillis = 5000;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getBaseDn() {
        return baseDn;
    }

    public void setBaseDn(String baseDn) {
        this.baseDn = baseDn;
    }

    public String getBindDn() {
        return bindDn;
    }

    public void setBindDn(String bindDn) {
        this.bindDn = bindDn;
    }

    public String getBindPassword() {
        return bindPassword;
    }

    public void setBindPassword(String bindPassword) {
        this.bindPassword = bindPassword;
    }

    public String getUserSearchFilter() {
        return userSearchFilter;
    }

    public void setUserSearchFilter(String userSearchFilter) {
        this.userSearchFilter = userSearchFilter;
    }

    public String getDisplayNameAttribute() {
        return displayNameAttribute;
    }

    public void setDisplayNameAttribute(String displayNameAttribute) {
        this.displayNameAttribute = displayNameAttribute;
    }

    public String getEmailAttribute() {
        return emailAttribute;
    }

    public void setEmailAttribute(String emailAttribute) {
        this.emailAttribute = emailAttribute;
    }

    public String getUidAttribute() {
        return uidAttribute;
    }

    public void setUidAttribute(String uidAttribute) {
        this.uidAttribute = uidAttribute;
    }

    public boolean isUseTls() {
        return useTls;
    }

    public void setUseTls(boolean useTls) {
        this.useTls = useTls;
    }

    public boolean isValidateCert() {
        return validateCert;
    }

    public void setValidateCert(boolean validateCert) {
        this.validateCert = validateCert;
    }

    public int getConnectTimeoutMillis() {
        return connectTimeoutMillis;
    }

    public void setConnectTimeoutMillis(int connectTimeoutMillis) {
        this.connectTimeoutMillis = connectTimeoutMillis;
    }

    public int getReadTimeoutMillis() {
        return readTimeoutMillis;
    }

    public void setReadTimeoutMillis(int readTimeoutMillis) {
        this.readTimeoutMillis = readTimeoutMillis;
    }
}
