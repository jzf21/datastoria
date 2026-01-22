import "@/index.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DataStoria",
  description: "AI-powered ClickHouse database management console with visualization capabilities",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Passive event listeners polyfill - must run before any libraries load
         * Eliminate such warning in the console: [Violation] Added non-passive event listener to a scroll-blocking <some> event. Consider marking event handler as 'passive' to make the page more responsive
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof EventTarget === 'undefined') return;
                var PASSIVE_EVENTS = ['wheel', 'mousewheel', 'touchstart', 'touchmove', 'touchend', 'touchcancel'];
                var original = EventTarget.prototype.addEventListener;
                EventTarget.prototype.addEventListener = function(type, listener, options) {
                  if (PASSIVE_EVENTS.indexOf(type) !== -1) {
                    var newOptions;
                    if (options === undefined || options === null) {
                      newOptions = { passive: true };
                    } else if (typeof options === 'boolean') {
                      newOptions = { capture: options, passive: true };
                    } else if (options.passive === false) {
                      newOptions = options;
                    } else {
                      newOptions = Object.assign({}, options, { passive: true });
                    }
                    return original.call(this, type, listener, newOptions);
                  }
                  return original.call(this, type, listener, options);
                };
              })();
            `,
          }}
        />
        {/* Avoid Theme inconsistancy under SSR which causes the screen splash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const storageKey = 'datastoria:settings:ui:theme';
                const theme = localStorage.getItem(storageKey) || 'dark';
                const root = document.documentElement;
                root.classList.remove('light', 'dark');
                if (theme === 'system') {
                  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  root.classList.add(systemTheme);
                } else {
                  root.classList.add(theme);
                }
              } catch (e) {
                // Ignore errors
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
