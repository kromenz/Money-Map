import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "../context/AuthContext";

export default function useRequireAuth(redirectTo = "/") {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(redirectTo);
    }
  }, [loading, user, redirectTo, router]);

  return { user, loading };
}
