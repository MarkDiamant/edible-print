import './globals.css';
const favicon='https://cdn.shopify.com/s/files/1/1000/0839/5135/files/ChatGPT_Image_Apr_19_2026_10_11_29_PM.png?v=1776633169';
export const metadata={
  title:'Edible Print | Custom Edible Icing Prints',
  description:'Custom edible icing prints for cakes, cupcakes, biscuits and branded treats. Fast UK dispatch.',
  icons:{icon:favicon,shortcut:favicon,apple:favicon}
};
export default function RootLayout({children}){return <html lang="en-GB"><body>{children}</body></html>}
