import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'LogGuard | AI-Powered Security Log Analyzer',
  description:
    'LogGuard is an AI-powered cybersecurity platform that analyzes security logs, detects anomalies, and generates SOC-ready intelligence reports in real-time.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <body
        className="bg-cyber-darker text-slate-800 min-h-screen antialiased"
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
