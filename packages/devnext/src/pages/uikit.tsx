import { MetaMaskButton, useAccount } from '@metamask/sdk-react-ui';
import { MetaMaskButton as NativeMetamaskButton } from '@metamask/sdk-ui';

import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { WalletActions } from '../components/WalletActions';

export default function UIKitPage() {
  const { isConnected, isConnecting, isDisconnected, isReconnecting } =
    useAccount();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <header className="App-header">
        <h1 className="text-3xl font-bold underline">Testing UI Kits</h1>
        <Link href={'/'}>Index Page</Link>
        <div>
          <MetaMaskButton theme={'light'} color="white"></MetaMaskButton>
        </div>
        <div>
          <NativeMetamaskButton theme={'light'} color="white" />
        </div>
        {isClient && (
          <pre>
            {JSON.stringify(
              { isConnected, isConnecting, isDisconnected, isReconnecting },
              null,
              2,
            )}
          </pre>
        )}
        {isConnected && <WalletActions />}
      </header>
    </>
  );
}
