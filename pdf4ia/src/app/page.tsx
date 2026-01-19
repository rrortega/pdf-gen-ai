"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const response = await fetch("/api/v1/auth/me", {
          credentials: "include",
        });
        const data = await response.json();

        if (response.ok && data.success) {
          router.push("/dashboard");
        } else {
          router.push("/login");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/login");
      }
    };

    checkAuthAndRedirect();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-lg">Loading...</div>
    </div>
  );
}
