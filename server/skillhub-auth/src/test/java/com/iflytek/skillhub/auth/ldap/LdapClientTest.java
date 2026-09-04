package com.iflytek.skillhub.auth.ldap;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LdapClientTest {

    private final LdapClient client = new LdapClient(new LdapProperties());

    @Test
    void escapeFilterValue_escapesSpecialCharacters() {
        assertThat(client.escapeFilterValue("alice")).isEqualTo("alice");
        assertThat(client.escapeFilterValue("a*b")).isEqualTo("a\\2ab");
        assertThat(client.escapeFilterValue("a(b)")).isEqualTo("a\\28b\\29");
        assertThat(client.escapeFilterValue("a\\b")).isEqualTo("a\\5cb");
        assertThat(client.escapeFilterValue("a\0b")).isEqualTo("a\\00b");
    }

    @Test
    void decodeObjectGuid_convertsLittleEndianGuidToUuid() {
        // A known 16-byte little-endian GUID.
        byte[] guid = new byte[] {
            0x2b, 0x1e, 0x3c, 0x4d, 0x5e, 0x6f, 0x70, (byte) 0x81,
            (byte) 0x92, (byte) 0xa3, (byte) 0xb4, (byte) 0xc5, (byte) 0xd6, (byte) 0xe7, 0x08, 0x19
        };
        String result = client.decodeObjectGuid(guid);
        // Must be a valid dashed UUID.
        assertThat(result).matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    }

    @Test
    void decodeObjectGuid_hexEncodesNon16ByteInput() {
        byte[] shortGuid = new byte[] { 0x01, 0x02, 0x03 };
        assertThat(client.decodeObjectGuid(shortGuid)).isEqualTo("010203");
    }

    @Test
    void decodeObjectSid_convertsToSidString() {
        // S-1-5-21-... style SID: revision=1, count=2, authority=5, subauths=[21, 1234]
        byte[] sid = new byte[] {
            0x01, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x05,
            0x15, 0x00, 0x00, 0x00, (byte) 0xd2, 0x04, 0x00, 0x00
        };
        String result = client.decodeObjectSid(sid);
        assertThat(result).isEqualTo("S-1-5-21-1234");
    }

    @Test
    void decodeObjectSid_hexEncodesMalformedInput() {
        byte[] shortSid = new byte[] { 0x01, 0x02 };
        assertThat(client.decodeObjectSid(shortSid)).isEqualTo("0102");
    }
}
