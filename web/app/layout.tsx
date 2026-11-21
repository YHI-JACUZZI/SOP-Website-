import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Allura, Archivo, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// Typed signatures on sign-offs and certificates.
const allura = Allura({
  variable: "--font-allura",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "SOP Hub",
  description: "Company SOPs and workflows, by role.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Each person's light/dark pick (no cookie = follow their device).
  const theme = (await cookies()).get("theme")?.value;
  return (
    <html lang="en" data-theme={theme === "dark" || theme === "light" ? theme : undefined}>
      <body
        className={`${archivo.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} ${allura.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
