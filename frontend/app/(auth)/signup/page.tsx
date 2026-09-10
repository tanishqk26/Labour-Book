"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "44px",
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid var(--color-outline-variant)",
  backgroundColor: "var(--color-surface-container-low)",
  color: "var(--color-on-surface)",
  fontSize: 15,
  outline: "none",
  fontFamily: "inherit",
};

export default function SignupPage() {
  const { user, loading, loginWithGoogle, signup } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  const handleCredential = useCallback(
    async (credential: string) => {
      setSubmitting(true);
      setError(null);
      try {
        await loginWithGoogle(credential);
        router.replace("/dashboard");
      } catch {
        setError("Sign-in failed. Please try again.");
        setSubmitting(false);
      }
    },
    [loginWithGoogle, router]
  );

  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signup(name, email, password);
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("An account with this email already exists.");
      } else {
        setError("Sign-up failed. Please try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <div
      className="w-full max-w-[440px] mx-4 p-8 rounded-2xl flex flex-col items-center text-center gap-6"
      style={{
        backgroundColor: "var(--color-surface-container-lowest)",
        border: "1px solid var(--color-outline-variant)",
        boxShadow: "0 8px 28px rgba(1, 45, 29, 0.12), 0 2px 8px rgba(1, 45, 29, 0.06)",
      }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: "var(--color-primary-fixed)" }}
      >
        <span
          className="material-symbols-outlined icon-fill"
          style={{ fontSize: "28px", color: "var(--color-primary)" }}
        >
          agriculture
        </span>
      </div>

      <div>
        <h1 className="text-headline-md font-bold" style={{ color: "var(--color-primary)" }}>
          Create your account
        </h1>
        <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
          Start managing labour, teams and payments
        </p>
      </div>

      <form onSubmit={handleSignupSubmit} className="w-full flex flex-col gap-3 text-left">
        <div className="flex flex-col gap-1.5">
          <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
            Name
          </label>
          <input
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            placeholder="Your name"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
            Email
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            placeholder="you@example.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
            Password
          </label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            placeholder="At least 8 characters"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="h-11 rounded-xl font-semibold text-body-md mt-1 transition-opacity"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "var(--color-on-primary)",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      {error && (
        <p className="text-label-caps -mt-2" style={{ color: "var(--color-error)" }}>
          {error}
        </p>
      )}

      <div className="w-full flex items-center gap-3">
        <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-outline-variant)" }} />
        <span className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
          OR
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-outline-variant)" }} />
      </div>

      <GoogleSignInButton onCredential={handleCredential} text="signup_with" />

      <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
        Already have an account?{" "}
        <Link href="/login" className="font-semibold" style={{ color: "var(--color-primary)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
