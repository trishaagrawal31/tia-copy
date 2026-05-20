"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/api";

export interface User {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  department: string | null;
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  setToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        setHasToken(true);
        const response = await getCurrentUser<User>();
        if (response.data) {
          setUser(response.data);
        } else if (response.status === 401) {
          // Token is invalid or expired - clear it
          localStorage.removeItem("token");
          setHasToken(false);
          setUser(null);
        }
        // For other errors (network, server down), keep the token 
        // and let the user stay "logged in" - pages will handle errors
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    setHasToken(false);
    setUser(null);
  };

  const setToken = (token: string) => {
    localStorage.setItem("token", token);
    setHasToken(true);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isLoggedIn: !!user || hasToken,
    setUser,
    logout,
    setToken,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
