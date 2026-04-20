"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/lib/userContext";

export default function UserSwitchPage() {
  const params = useParams<{ username: string }>();
  const { setCurrentUser } = useUser();
  const router = useRouter();

  useEffect(() => {
    setCurrentUser(params.username);
    router.replace("/");
  }, [params.username, setCurrentUser, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50" dir="rtl">
      <p className="text-gray-500 text-sm">מחליף משתמש...</p>
    </div>
  );
}
