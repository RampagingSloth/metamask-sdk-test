import { useSDK } from '@metamask/sdk-react';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { ItemView } from '../item-view/item-view';
import Text from '../../design-system/components/Texts/Text';

const styles = StyleSheet.create({
  container: {},
  waitingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
});

export interface SDKStatusProps {
  response: unknown;
  requesting?: boolean;
  error?: any;
}

export const SDKStatus = ({ response, requesting, error }: SDKStatusProps) => {
  const {
    connected,
    connecting,
    balance,
    balanceProcessing,
    channelId,
    extensionActive,
    account,
    sdk,
    chainId,
  } = useSDK();

  return (
    <View style={styles.container}>
      {connecting && (
        <View style={styles.waitingContainer}>
          <ActivityIndicator size="small" />
          <Text>Waiting for Metamask to link the connection...</Text>
        </View>
      )}
      {connected && (
        <View>
          <ItemView label="SDK Version" value={sdk?.getVersion()} />
          {!extensionActive && (
            <>
              <ItemView label="ChannelId" value={channelId} />
            </>
          )}
          <ItemView label="Connected" value={connected ? 'YES' : 'NO'} />
          <ItemView
            label="Extension active"
            value={extensionActive ? 'YES' : 'NO'}
          />
          <ItemView label="Connected chain" value={chainId} />
          <ItemView label="Connected account" value={account} />
          <ItemView
            label="Account balance"
            value={balance}
            processing={balanceProcessing}
          />
          {error ? (
            <ItemView
              label="Last request error"
              processing={requesting}
              error={true}
              value={JSON.stringify({
                code: error.code,
                message: error.message,
              })}
            />
          ) : (
            <ItemView
              label="Last request response"
              processing={requesting}
              value={JSON.stringify(response)}
            />
          )}
        </View>
      )}
    </View>
  );
};
