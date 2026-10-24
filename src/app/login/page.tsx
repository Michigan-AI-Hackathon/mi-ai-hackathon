import { Suspense } from "react";
import Logo from "@/components/Logo";
import LoginForm from "./LoginForm";
import TestLogin from "./TestLogin";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6 sm:px-6">
      <Logo />
      <div className="my-auto py-12">
        <h1 className="font-heading text-4xl font-bold">Sign in or create your account</h1>
        <p className="mt-3 text-[16px] text-muted">
          Use your school email. We&apos;ll email you a sign-in link, so there&apos;s no password to remember.
        </p>
        <Suspense><LoginForm /></Suspense>
        {process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN === "true" && <TestLogin />}
      </div>
    </div>
  );
}
