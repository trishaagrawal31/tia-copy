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

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        const response = await getCurrentUser<User>();
        if (response.data) {
          setUser(response.data);
        } else {
          // Token is invalid or expired - clear it
          localStorage.removeItem("token");
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  const setToken = (token: string) => {
    localStorage.setItem("token", token);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isLoggedIn: !!user,
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
