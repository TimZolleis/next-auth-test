import {CookieJar} from 'tough-cookie';
import {wrapper} from 'axios-cookiejar-support';
import type {CookieAgent} from 'http-cookie-agent/http';
import {HttpsCookieAgent} from 'http-cookie-agent/http';
import type * as https from 'https';
import type {InternalAxiosRequestConfig} from 'axios';
import axios, {AxiosRequestConfig} from 'axios';
import {Buffer} from "buffer";

declare global {
    var __lastApiRequest: number | undefined;
}

function requestScheduler(config: InternalAxiosRequestConfig, delayInMs: number) {
    global.__lastApiRequest = undefined;
    if (__lastApiRequest) {
        const timeToWait = __lastApiRequest + delayInMs - Date.now();
        if (timeToWait > 0) {
            return new Promise<InternalAxiosRequestConfig>((resolve) => {
                setTimeout(() => resolve(config), timeToWait);
            });
        }
    }
    __lastApiRequest = Date.now();
    return config;
}

export function getLoginClient(jar: CookieJar = new CookieJar()) {
    const client = wrapper(
        axios.create({
            httpAgent: getAgent(jar),
            httpsAgent: getAgent(jar),
            headers: {...getDefaultHeaders()},
        })
    );
    client.interceptors.request.use((config) => requestScheduler(config, 100));
    return {cookieJar: jar, client};
}

function getAgent(jar: CookieJar): CookieAgent<https.Agent> {
    return new HttpsCookieAgent({
        ciphers: [
            'TLS_CHACHA20_POLY1305_SHA256',
            'TLS_AES_128_GCM_SHA256',
            'TLS_AES_256_GCM_SHA384',
            'TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256',
        ].join(':'),
        honorCipherOrder: true,
        minVersion: 'TLSv1.2',
        cookies: {jar},
    });
}

export function getDefaultHeaders() {
    return {
        'content-type': AXIOS_CONSTANTS.CONTENT_TYPE,
        'user-agent': AXIOS_CONSTANTS.USER_AGENT,
        'X-Riot-ClientVersion': AXIOS_CONSTANTS.CLIENT_VERSION,
        ...getClientPlatformHeader(),
    };
}

const AXIOS_CONSTANTS = {
    USER_AGENT: 'RiotClient/63.0.10.4802528.4749685 rso-auth (Windows;10;;Professional, x64)',
    CLIENT_VERSION: "release-06.05-shipping-11-843632",
    CLIENT_PLATFORM: {
        platformType: 'PC',
        platformOS: 'Windows',
        platformOSVersion: '10.0.19042.1.256.64bit',
        platformChipset: 'Unknown',
    },
    CONTENT_TYPE: 'application/json',
    CIPHERS: [
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_128_GCM_SHA256',
        'TLS_AES_256_GCM_SHA384',
        'TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256',
    ],
};

export function getAuthorizationHeader(accessToken: string) {
    return {
        Authorization: `Bearer ${accessToken}`,
    };
}

export function getEntitlementsHeader(entitlementsToken: string) {
    return {
        'X-Riot-Entitlements-JWT': entitlementsToken,
    };
}

export function getClientPlatformHeader() {
    return {
        'X-Riot-ClientPlatform': Buffer.from(JSON.stringify(AXIOS_CONSTANTS.CLIENT_PLATFORM)).toString("base64"),
    };
}
