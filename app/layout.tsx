import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Chatbot from '@/components/chatbot';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://karmaayurvedahospital.co'),
  title: 'Karma Ayurveda | Health Assistant',
  description: 'Chat with the Karma Ayurveda health assistant and connect with our care team.',
  openGraph: {
    images: [
      {
        url: 'https://bolt.new/static/og_default.png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: 'https://bolt.new/static/og_default.png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Chatbot />
      </body>
    </html>
  );
}
