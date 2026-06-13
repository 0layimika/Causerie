import './globals.css';

export const metadata = {
  title: 'Causerie',
  description: 'A judgment-free French speaking partner for daily reps.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/assets/icon.svg'
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f6d36b'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
