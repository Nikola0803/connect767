import { useEffect, useRef, useState } from "react";
import { getStoredToken, getStoredUser } from "../lib/apiClient";
import { logout as authLogout, refreshCurrentUser } from "../lib/authClient";

function readAuthState() {
  const token = getStoredToken();
  if (!token) return {
    isAuthenticated: false,
    email: null,
    name: null,
    accountType: null,
    profilePhoto: "",
    profilePhotoPosition: "center",
    profilePhotoZoom: 1,
  };
  const user = getStoredUser();
  return {
    isAuthenticated: true,
    email: user?.email || null,
    name: user?.name || null,
    accountType: user?.accountType || null,
    profilePhoto: user?.profilePhoto || "",
    profilePhotoPosition: user?.profilePhotoPosition || "center",
    profilePhotoZoom: Number(user?.profilePhotoZoom) || 1,
  };
}

export function useAuth() {
  const [state, setState] = useState(readAuthState);
  const refreshAttempted = useRef(false);

  useEffect(() => {
    const onChange = () => setState(readAuthState());
    window.addEventListener("c767-auth-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("c767-auth-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  useEffect(() => {
    if (!state.isAuthenticated || state.profilePhoto || refreshAttempted.current) return;
    refreshAttempted.current = true;
    refreshCurrentUser().catch(() => {});
  }, [state.isAuthenticated, state.profilePhoto]);

  return { ...state, logout: authLogout };
}
