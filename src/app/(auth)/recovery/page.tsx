import type { Metadata } from "next";
import RecoveryClient from "./RecoveryClient";

export const metadata: Metadata = {
    title: "Reset password",
    description: "Enter your email address to reset your password",
};

export default function RecoveryPage() {
    return <RecoveryClient />;
}
