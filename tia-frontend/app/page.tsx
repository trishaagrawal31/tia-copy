"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LoadingSpinner } from "@/components";
import { Zap } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { isLoading, isLoggedIn } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isLoggedIn) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [isLoggedIn, isLoading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl">
            <Zap className="h-7 w-7 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">TIA</h1>
        <p className="text-muted-foreground mb-8">The Innovative Assistant</p>
        <LoadingSpinner size="md" />
      </div>
    </div>
  );
}
