/**
 * LDAP direct-auth extension for SkillHub.
 *
 * <p>This package is a self-contained, non-invasive extension: it implements the
 * upstream {@link com.iflytek.skillhub.auth.direct.DirectAuthProvider} SPI and is
 * activated only when {@code skillhub.auth.ldap.enabled=true}. No upstream core
 * source file depends on this package, so it can be removed or upgraded without
 * touching the rest of the codebase.
 */
package com.iflytek.skillhub.auth.ldap;
