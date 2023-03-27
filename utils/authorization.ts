import {getAuthorizationHeader, getLoginClient} from "@/utils/axios";
import {redirect} from "next/navigation";
import {CookieJar} from "tough-cookie";
import {RSOUserInfo} from "@/models/RSOUserInfo";

export type AuthType = 'multifactor' | 'response';

export interface ValorantAuthenticationTokenResponse {
    type: AuthType;
    response: Response;
    country: string;
}

export interface Multifactor {
    email: string;
    method: string;
    methods: string[];
    multiFactorCodeLength: number;
    mfaVersion: string;
}

export interface ValorantAuthenticationMultifactorResponse {
    type: AuthType;
    multifactor: Multifactor;
    country: string;
    securityProfile: string;
}

export interface Parameters {
    uri: string;
}

export interface Response {
    mode: string;
    parameters: Parameters;
}


export async function authorizeRiotAccount(username: string, password: string) {
    const {client, cookieJar} = getLoginClient()
    //Request auth cookies
    try {
        await client.post("https://auth.riotgames.com/api/v1/authorization", {
            client_id: 'play-valorant-web-prod',
            nonce: 1,
            redirect_uri: 'https://playvalorant.com/opt_in',
            response_type: 'token id_token',
            scope: 'account openid',
        })
    } catch (e) {
        console.log("There was an error requesting auth cookies")
    }
    //Request access token (or trigger mfa request)
    const response = await client.put<ValorantAuthenticationTokenResponse | ValorantAuthenticationMultifactorResponse>("https://auth.riotgames.com/api/v1/authorization", {
        type: "auth",
        username,
        password,
        remember: true,
        language: "en_US",
    })
    if (isMultifactorResponse(response.data)) {
        const cookies = await getMfaCookies(cookieJar)
        const base64 = Buffer.from(JSON.stringify(cookies)).toString("base64")
        return {
            isAuthenticated: false,
            isMultifactor: true,
            multifactorCookiesBase64: base64
        }
    }
    //If its not 2fa, parse the tokes and return them
    const {accessToken} = parseAuthorizationToken(response.data.response.parameters.uri)

    //If we have the token, we can request the entitlement
    const entitlementResponse = await client.post("https://entitlements.auth.riotgames.com/api/token/v1", {}, {headers: {...getAuthorizationHeader(accessToken)}})
    const entitlementToken = entitlementResponse.data.entitlements_token

    //If we have access token and entitlement we can even request some cool user data to verify everything works
    const userData = await client.get<RSOUserInfo>("https://auth.riotgames.com/userinfo", {
        headers: {
            ...getAuthorizationHeader(accessToken)
        }
    }).then(res => res.data)
    //If we are done authenticating the user, we can return the necessary information

    return {
        isAuthenticated: true,
        isMultifactor: false,
        userInfo: {
            accessToken,
            entitlementToken,
            userData
        }
    }
}

export async function authorizeWithMultifactor(multifactorCode: string, {clid, asid}: { clid: string, asid: string }) {
    //Lets set up a cookie jar with the respective cookies
    const jar = new CookieJar(undefined, {rejectPublicSuffixes: false})
    const domain = "https://auth.riotgames.com"
    await Promise.all([
        jar.setCookie(clid, domain),
        jar.setCookie(asid, domain)
    ])
    const {client, cookieJar} = getLoginClient(jar)
    //After now having the cookies and a client, we can retrieve the necessary information with the code
    const accessTokenResponse = await client.put<ValorantAuthenticationTokenResponse>("https://auth.riotgames.com/api/v1/authorization", {
        type: "multifactor",
        code: multifactorCode,
        rememberDevice: true
    })
    const {accessToken} = parseAuthorizationToken(accessTokenResponse.data.response.parameters.uri)
    //Now we can essentially proceed like before. If you were in a real project, you would just set this up in some functions so you dont have to write duplicate code
    const entitlementResponse = await client.post("https://entitlements.auth.riotgames.com/api/token/v1", {}, {headers: {...getAuthorizationHeader(accessToken)}})
    const entitlementToken = entitlementResponse.data.entitlements_token

    const userData = await client.get<RSOUserInfo>("https://auth.riotgames.com/userinfo", {
        headers: {
            ...getAuthorizationHeader(accessToken)
        }
    }).then(res => res.data)
    return {
        isAuthenticated: true,
        isMultifactor: true,
        userInfo: {
            accessToken,
            entitlementToken,
            userData
        }
    }


}


function isMultifactorResponse(response: ValorantAuthenticationMultifactorResponse | ValorantAuthenticationTokenResponse): response is ValorantAuthenticationMultifactorResponse {
    return response.type === "multifactor"
}

async function getMfaCookies(cookieJar: CookieJar) {
    const strings = await cookieJar.getSetCookieStrings("https://auth.riotgames.com");
    let asid = "";
    let clid = "";
    strings.forEach(cookieString => {
        if (cookieString.includes("asid")) {
            asid = cookieString;
        }
        if (cookieString.includes("clid")) {
            clid = cookieString;
        }
    });
    return {asid, clid}
}

function parseAuthorizationToken(uri: string) {
    const url = new URL(uri);
    const params = new URLSearchParams(url.hash.substring(1));
    const accessToken = params.get('access_token');
    const idToken = params.get('id_token');

    if (!accessToken) {
        throw new Error("No access token")
    }
    if (!idToken) {
        console.log("There is no id token in response")
    }
    return {
        idToken,
        accessToken,
    };
}


