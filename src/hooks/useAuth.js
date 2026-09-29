import { useEffect, useState } from "react";
import { getStoredToken, getStoredUser } from "../lib/apiClient";
import { logout as authLogout } from "../lib/authClient";

function readAuthState() {
  const token = getStoredToken();
  if (!token) return { isAuthenticated: false, email: null, name: null, accountType: null };
  const user = getStoredUser();
  return {
    isAuthenticated: true,
    email: user?.email || null,
    name: user?.name || null,
    accountType: user?.accountType || null,
  };
}

export function useAuth() {
  const [state, setState] = useState(readAuthState);

  useEffect(() => {
    const onChange = () => setState(readAuthState());
    window.addEventListener("c767-auth-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("c767-auth-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return { ...state, logout: authLogout };
}
