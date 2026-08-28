import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bonn Mobility",
  description:
    "Live-Verfügbarkeit und Historie des Welo-Fahrradmietsystems in Bonn und Rhein-Sieg.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
