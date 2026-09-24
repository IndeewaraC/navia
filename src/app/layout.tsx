import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Navia | Zero-Trust Privacy Vault",
  description: "Calculate your exact Survival Runway through a dual-layer budgeting engine that never sells your data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-slate-950 text-slate-100 selection:bg-emerald-500/30">
        {children}
      </body>
    </html>
  );
}
