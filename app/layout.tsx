import type { Metadata } from "next";
import "./globals.css";
import "./business-design.css";
import "./classic-workspace.css";
import "./premium.css";
import "./training.css";
export const metadata: Metadata = { title: "BizWise", description: "Your small business, in focus. Jobs, payments and practical advice in one workspace.", icons: {icon:`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg`} };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
