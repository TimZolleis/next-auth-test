import {getServerSession} from "next-auth";
import {authOptions} from "@/pages/api/auth/[...nextauth]";

export default async function Home() {
    return <div>
        <p>This is the main page</p>
    </div>

}
