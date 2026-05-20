"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getCurrentUser, onAuthError, offAuthError } from "@/lib/api";

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
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
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
    } else {
      setUser(null);
    }
  }, []);

  // Subscribe to auth errors from API calls
  useEffect(() => {
    const handleAuthError = () => {
      // When a 401 occurs, clear the user state and token
      localStorage.removeItem("token");
      setUser(null);
    };

    onAuthError(handleAuthError);
    return () => offAuthError(handleAuthError);
  }, []);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    let isCancelled = false;

    const initializeAuth = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        const response = await getCurrentUser<User>();
        if (!isCancelled) {
          if (response.data) {
            setUser(response.data);
          } else {
            // Token is invalid or expired - clear it
            localStorage.removeItem("token");
            setUser(null);
          }
        }
      }
      if (!isCancelled) {
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isCancelled = true;
    };
  }, []);

  const setToken = useCallback((token: string) => {
    localStorage.setItem("token", token);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isLoggedIn: !!user,
    setUser,
    logout,
    setToken,
    refreshUser,
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
