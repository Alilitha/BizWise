import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "BizWise Garage", description: "Practical business advice for independent repair shops", icons: {icon:`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg`} };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
