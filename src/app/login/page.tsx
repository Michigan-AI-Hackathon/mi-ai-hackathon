import { Suspense } from "react";
import Logo from "@/components/Logo";
import LoginForm from "./LoginForm";
import TestLogin from "./TestLogin";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const checkingIn = ((await searchParams).next ?? "").startsWith("/checkin");
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6 sm:px-6">
      <Logo />
      <div className="my-auto py-12">
        <h1 className="font-heading text-4xl font-bold">{checkingIn ? "Sign in to check in" : "Sign in"}</h1>
        {checkingIn && <p className="mt-2 text-[16px] text-muted">Use your school email. You&apos;ll be checked in as soon as you&apos;re signed in.</p>}
        {process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN === "true" ? <Suspense><TestLogin /></Suspense> : <Suspense><LoginForm /></Suspense>}
      </div>
    </div>
  );
}
