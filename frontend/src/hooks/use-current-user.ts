"use client";

import { decodeToken, getToken } from "@/lib/auth";
import { useMemo } from "react";

export function useCurrentUser() {
  return useMemo(() => {
    const token = getToken();
    if (!token) return null;
    return decodeToken(token);
  }, []);
}
