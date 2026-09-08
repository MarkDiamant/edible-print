import './globals.css';
const logo='https://raw.githubusercontent.com/MarkDiamant/edible-print/main/logo.png';
export const metadata={
  title:'Edible Print | Custom Edible Icing Prints',
  description:'Custom edible icing prints for cakes, cupcakes, biscuits and branded treats. Fast UK dispatch.',
  icons:{icon:logo,shortcut:logo,apple:logo}
};
export default function RootLayout({children}){return <html lang="en"><body>{children}</body></html>}
