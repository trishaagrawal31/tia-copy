"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, useAuth } from "@/context/AuthContext";
import { login, createUser, getCurrentUser } from "@/lib/api";
import { Input, Select, Button, Alert, useToast } from "@/components";
import { Zap, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("student");
  const [department, setDepartment] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { setUser, setToken } = useAuth();
  const { addToast } = useToast();

  const validateLoginForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!email.trim()) newErrors.email = "Email is required";
    if (!password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignupForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!firstName.trim()) newErrors.firstName = "First name is required";
    if (!lastName.trim()) newErrors.lastName = "Last name is required";
    if (!email.trim()) newErrors.email = "Email is required";
    if (!password) newErrors.password = "Password is required";
    if (password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrors({});

    if (!validateLoginForm()) return;

    setLoading(true);

    const response = await login(email, password);

    if (response.error) {
      setError(response.error);
      addToast(response.error, "error");
      setLoading(false);
      return;
    }

    if (response.data?.access_token) {
      setToken(response.data.access_token);

      const userResponse = await getCurrentUser<User>();
      if (userResponse.data) {
        setUser(userResponse.data);
        addToast("Welcome back!", "success");
        router.push("/dashboard");
      } else {
        const errMsg = userResponse.error || "Failed to fetch user information";
        setError(errMsg);
        addToast(errMsg, "error");
      }
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrors({});

    if (!validateSignupForm()) return;

    setLoading(true);

    const response = await createUser({
      email,
      password,
      first_name: firstName,
      last_name: lastName,
      role,
      department,
    });

    if (response.error) {
      setError(response.error);
      addToast(response.error, "error");
      setLoading(false);
      return;
    }

    const loginResponse = await login(email, password);
    if (loginResponse.data?.access_token) {
      setToken(loginResponse.data.access_token);

      const userResponse = await getCurrentUser<User>();
      if (userResponse.data) {
        setUser(userResponse.data);
        addToast("Account created successfully!", "success");
        router.push("/dashboard");
      }
    } else {
      const errMsg = loginResponse.error || "Failed to login after signup";
      setError(errMsg);
      addToast(errMsg, "error");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-violet-700" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-white rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-xl backdrop-blur">
              <Zap className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold">TIA</span>
          </div>
          
          <div className="space-y-6">
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight text-balance">
              Your AI-Powered Research Assistant
            </h1>
            <p className="text-lg text-white/80 max-w-md leading-relaxed">
              Collaborate with TIA to enhance your academic research, writing, and critical thinking in the Liberal Arts.
            </p>
            
            <div className="flex items-center gap-4 pt-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/30 backdrop-blur"
                  />
                ))}
              </div>
              <p className="text-sm text-white/70">
                Trusted by 1,000+ students and researchers
              </p>
            </div>
          </div>
          
          <p className="text-sm text-white/50">
            The Innovative Assistant for Liberal Arts
          </p>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-xl">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <span className="text-2xl font-bold text-foreground">TIA</span>
          </div>

          <div className="space-y-2 mb-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-foreground">
              {isLogin ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-base text-muted-foreground">
              {isLogin
                ? "Sign in to continue your research journey"
                : "Start collaborating with TIA today"}
            </p>
          </div>

          {error && (
            <Alert
              type="error"
              message={error}
              onClose={() => setError("")}
              className="mb-6"
            />
          )}

          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <Input
                id="login-email"
                label="Email Address"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: "" });
                }}
                error={errors.email}
                required
              />

              <Input
                id="login-password"
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors({ ...errors, password: "" });
                }}
                error={errors.password}
                required
              />

              <Button
                type="submit"
                disabled={loading}
                loading={loading}
                variant="primary"
                fullWidth
                size="lg"
                className="mt-2"
              >
                {loading ? "Signing in..." : "Sign In"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="signup-firstname"
                  label="First Name"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (errors.firstName) setErrors({ ...errors, firstName: "" });
                  }}
                  error={errors.firstName}
                  required
                />
                <Input
                  id="signup-lastname"
                  label="Last Name"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (errors.lastName) setErrors({ ...errors, lastName: "" });
                  }}
                  error={errors.lastName}
                  required
                />
              </div>

              <Input
                id="signup-email"
                label="Email Address"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: "" });
                }}
                error={errors.email}
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <Select
                  id="signup-role"
                  label="Role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  options={[
                    { value: "student", label: "Student" },
                    { value: "faculty", label: "Faculty" },
                  ]}
                />

                <Input
                  id="signup-department"
                  label="Department"
                  type="text"
                  placeholder="Liberal Arts"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>

              <Input
                id="signup-password"
                label="Password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors({ ...errors, password: "" });
                }}
                error={errors.password}
                helperText={!errors.password ? "At least 6 characters" : undefined}
                required
              />

              <Button
                type="submit"
                disabled={loading}
                loading={loading}
                variant="primary"
                fullWidth
                size="lg"
                className="mt-2"
              >
                {loading ? "Creating account..." : "Create Account"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-border text-center">
            {isLogin ? (
              <p className="text-base text-muted-foreground">
                {"Don't have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setError("");
                    setErrors({});
                  }}
                  className="text-primary font-semibold hover:underline transition"
                >
                  Create one
                </button>
              </p>
            ) : (
              <p className="text-base text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setError("");
                    setErrors({});
                  }}
                  className="text-primary font-semibold hover:underline transition"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
