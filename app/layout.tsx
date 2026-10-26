import type { Metadata } from "next";
import "./globals.css";
import "./research.css";

export const metadata: Metadata = {
  title: "ballknowledge — See the whole game.",
  description:
    "An NBA player exploration and comparison workspace. Explore real NBA player game logs with traceable sources and shared analysis filters.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
