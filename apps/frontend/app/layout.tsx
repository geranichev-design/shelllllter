import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { FigmaCaptureButton } from './components/FigmaCaptureButton';
import { ThemeProvider } from './providers/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Реєстр укриттів',
  description: 'Платформа для управління укриттями'
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();`
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <FigmaCaptureButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
