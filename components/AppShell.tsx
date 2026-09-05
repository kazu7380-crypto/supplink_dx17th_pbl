"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { FloatingCartButton } from "@/components/FloatingCartButton";
import { CartModal } from "@/components/CartModal";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:pb-40">{children}</main>
      <FloatingCartButton />
      <CartModal />
    </>
  );
}
