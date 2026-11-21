import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Allura, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";

// "Ember" look: Manrope for headings and text.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
  // Each person's light/dark pick. Ember is dark first, so dark is the default.
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="en" data-theme={theme}>
      <body
        className={`${manrope.variable} ${jetbrainsMono.variable} ${allura.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
