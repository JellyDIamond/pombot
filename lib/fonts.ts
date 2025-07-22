import localFont from 'next/font/local'

export const fontSans = localFont({
  src: [
    {
      path: '../assets/fonts/Inter-Regular.woff',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../assets/fonts/Inter-Bold.woff',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-sans',
  display: 'swap',
})

export const fontMono = localFont({
  src: '../assets/fonts/Inter-Regular.woff',
  variable: '--font-mono',
  display: 'swap',
})