package com.iflytek.skillhub.auth.ldap;

import javax.net.SocketFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.IOException;
import java.net.InetAddress;
import java.net.Socket;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;

/**
 * A socket factory that trusts all server certificates.
 *
 * <p>Used only when {@code skillhub.auth.ldap.validate-cert=false} is set for
 * trusted internal directories. This disables certificate validation and must
 * not be used for untrusted networks.
 */
public final class TrustAllSocketFactory extends SocketFactory {

    private static final TrustAllSocketFactory INSTANCE = new TrustAllSocketFactory();
    private static final SocketFactory DELEGATE = createTrustAllDelegate();

    private TrustAllSocketFactory() {
    }

    public static SocketFactory getDefault() {
        return INSTANCE;
    }

    private static SocketFactory createTrustAllDelegate() {
        try {
            TrustManager[] trustAll = new TrustManager[] {
                new X509TrustManager() {
                    @Override
                    public void checkClientTrusted(X509Certificate[] chain, String authType) {
                    }

                    @Override
                    public void checkServerTrusted(X509Certificate[] chain, String authType) {
                    }

                    @Override
                    public X509Certificate[] getAcceptedIssuers() {
                        return new X509Certificate[0];
                    }
                }
            };
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(null, trustAll, new SecureRandom());
            return context.getSocketFactory();
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to initialize trust-all socket factory", ex);
        }
    }

    @Override
    public Socket createSocket() throws IOException {
        return DELEGATE.createSocket();
    }

    @Override
    public Socket createSocket(String host, int port) throws IOException {
        return DELEGATE.createSocket(host, port);
    }

    @Override
    public Socket createSocket(String host, int port, InetAddress localHost, int localPort) throws IOException {
        return DELEGATE.createSocket(host, port, localHost, localPort);
    }

    @Override
    public Socket createSocket(InetAddress host, int port) throws IOException {
        return DELEGATE.createSocket(host, port);
    }

    @Override
    public Socket createSocket(InetAddress address, int port, InetAddress localAddress, int localPort)
            throws IOException {
        return DELEGATE.createSocket(address, port, localAddress, localPort);
    }
}
