import CredentialsProvider from "next-auth/providers/credentials";
import {authorizeRiotAccount, authorizeWithMultifactor} from "@/utils/authorization";
import {redirect} from "next/navigation";
import NextAuth from "next-auth";


type AuthCookies = {
    clid: string,
    asid: string
}

function parseCookieString(cookieString: string): AuthCookies {
    const parsed = Buffer.from(cookieString, 'base64').toString('utf-8')
    return JSON.parse(Buffer.from(parsed).toString("utf-8"))
}


export const authOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            type: "credentials",
            credentials: {
                username: {label: "Username", type: "text", placeholder: "username"},
                password: {label: "Password", type: "password"},
                multifactorCode: {label: "MFACode", type: "text"}
            },
            async authorize(credentials, request) {

                //That handles the case if MFA is required
                if (request.query?.cookies && request.query?.mfa) {
                    if (!credentials?.multifactorCode) {
                        throw new Error("Invalid code")
                    }
                    const authCookies = parseCookieString(request.query?.cookies)
                    const response = await authorizeWithMultifactor(credentials.multifactorCode, authCookies)
                    if (!response.userInfo) {
                        console.log("Login failed")
                        return null
                    }
                    console.log("Auth successful")
                    return {
                        id: response.userInfo.userData.sub,
                        name: response.userInfo.userData.acct.game_name,
                        accessToken: response.userInfo.accessToken,
                        entitlementToken: response.userInfo.entitlementToken
                    };

                }
                if (!credentials?.username) {
                    throw new Error("No username specified")
                }
                if (!credentials?.password) {
                    throw new Error("No password specified")
                }
                const response = await authorizeRiotAccount(credentials.username, credentials.password)
                if (response.isMultifactor && !response.isAuthenticated && response.multifactorCookiesBase64) {
                    throw new Error(`mfa&cookies=${response.multifactorCookiesBase64}`)
                }
                if (!response.userInfo) {
                    return null;
                }
                console.log("Auth successful")
                //If we have a user and its not mfa, we good
                return {
                    id: response.userInfo.userData.sub,
                    name: response.userInfo.userData.acct.game_name,
                    accessToken: response.userInfo.accessToken,
                    entitlementToken: response.userInfo.entitlementToken
                };

            },
        })
    ],
    session: {

    },
    pages: {
        signIn: "/login",
        error: '/login'
    }

}

class MultifactorRequiredException extends Error {

    base64string: string

    constructor(base64: string) {
        super("mfa");
        this.base64string = base64;
    }

}


export default NextAuth(authOptions)