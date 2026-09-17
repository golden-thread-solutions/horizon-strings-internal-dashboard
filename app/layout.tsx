import type { Metadata } from "next";
import { Workspace } from "@/components/Workspace";
import "./globals.css";
export const metadata: Metadata = {
  title: "Horizon Strings · Operations",
  description: "Private Horizon Strings operations workspace",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
  const demo =
    process.env.NODE_ENV === "development" &&
    process.env.DASHBOARD_DEMO_MODE === "true" &&
    !configured;
  return (
    <html lang="en-AU">
      <body>
        <Workspace demo={demo} configured={configured}>
          {children}
        </Workspace>
      </body>
    </html>
  );
}
