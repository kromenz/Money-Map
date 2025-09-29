import Head from "next/head";
import "../styles/globals.css";

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>{<link rel="icon" type="image/png" href="/logo.png" />}</Head>
      <Component {...pageProps} />
    </>
  );
}
