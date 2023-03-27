"use client"
import {useEffect, useState} from "react";
import {mockSession} from "next-auth/client/__tests__/helpers/mocks";
import user = mockSession.user;
import {signIn} from "next-auth/react";
import {router} from "next/client";

interface PageProps {
    searchParams?: { [key: string]: string | string[] | undefined };
}

const LoginPage = ({searchParams}: PageProps) => {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [multifactorCode, setmultifactorCode] = useState("")
    const [requiresMfa, setRequiresMFA] = useState(false)
    const handleSubmit = async (mfa: boolean, params?: {}) => {
        const cookies = searchParams?.cookies as string | undefined || ""
        const result = await signIn("credentials", {
            username,
            password,
            multifactorCode,
            redirect: true
        }, {mfa: mfa.toString(), cookies, ...params})
    }
    useEffect(() => {
        if (searchParams?.error === "mfa" && searchParams.cookies && !requiresMfa) {
            setRequiresMFA(true)
        }
    }, [searchParams])


    return <main className={"w-full flex flex-col items-center justify-center mt-10"}>
        <section>
            <p className={"font-bold text-xl"}>Please login</p>
        </section>
        {
            !requiresMfa && <div className={"w-full flex flex-col items-center justify-center"}>
                <div className={"flex flex-col w-1/4 py-2"}>
                    <label htmlFor={"username"}>Username</label>
                    <input onChange={(e) => setUsername(e.target.value)}
                           className={"rounded-md border border-gray-500 px-3 py-1.5 w-full"} name={"username"}
                           type="text"/>
                </div>
                <div className={"flex flex-col w-1/4 py-2"}>
                    <label htmlFor={"password"}>Password</label>
                    <input onChange={(e) => setPassword(e.target.value)}
                           className={"rounded-md border border-gray-500 px-3 py-1.5 w-full"}
                           name={"password"}
                           type="password"/>
                </div>
            </div>
        }
        {
            requiresMfa && <div className={"flex flex-col w-1/4 py-2"}>
                <label htmlFor={"password"}>MFA Code</label>
                <input onChange={(e) => setmultifactorCode(e.target.value)}
                       className={"rounded-md border border-gray-500 px-3 py-1.5 w-full"}
                       name={"mfa"}
                       type="text"/>
            </div>
        }
        <button className={"w-1/4 px-3 py-1.5 bg-blue-500 mt-2 text-white rounded-md"}
                onClick={() => handleSubmit(requiresMfa)}>Login
        </button>
    </main>
}

export default LoginPage;