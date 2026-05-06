import type { Metadata } from "next";
import "./globals.css";
import { CartProvider, RoomProvider } from "@/components/providers";
import { Header } from "@/components/Header";
import { FloatingCartButton } from "@/components/FloatingCartButton";
import { CartModal } from "@/components/CartModal";

export const metadata: Metadata = {
  title: "サプリンク - 物品オーダーシステム",
  description: "手術室（OP室）からサプライ課への物品オーダーシステム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <RoomProvider>
          <CartProvider>
            <Header />
            <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
            <FloatingCartButton />
            <CartModal />
          </CartProvider>
        </RoomProvider>
      </body>
    </html>
  );
}
