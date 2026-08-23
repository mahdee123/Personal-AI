import type { Metadata, Viewport } from "next";

import { WorkspaceProvider } from "@/context/WorkspaceProvider";
import { APP_NAME } from "@/lib/constants";

import "highlight.js/styles/github-dark.css";
import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} — Personal AI Workspace`,
  description:
    "A private personal AI workspace running fully offline on a local Ollama model.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-canvas text-ink antialiased">
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </body>
    </html>
  );
}
