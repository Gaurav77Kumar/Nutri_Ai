"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { ReactNode } from "react";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith("your-")) {
    // Falls back to children but logs warning if not configured
    console.warn("Google Client ID not configured. Authentication will not work.");
    return <>{children}</>;
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {children}
    </GoogleOAuthProvider>
  );
}
