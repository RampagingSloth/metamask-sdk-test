import {
  CommunicationLayerPreference,
  EventType,
  PlatformType,
} from '@metamask/sdk-communication-layer';
import packageJson from '../../package.json';
import { MetaMaskInstaller } from '../Platform/MetaMaskInstaller';
import { PlatformManager } from '../Platform/PlatfformManager';
import { getPostMessageStream } from '../PostMessageStream/getPostMessageStream';
import { METHODS_TO_REDIRECT, RPC_METHODS } from '../config';
import { ProviderConstants } from '../constants';
import { MetaMaskSDK } from '../sdk';
import { Ethereum } from '../services/Ethereum';
import { RemoteConnection } from '../services/RemoteConnection';
import { rpcRequestHandler } from '../services/rpc-requests/RPCRequestHandler';
import { PROVIDER_UPDATE_TYPE } from '../types/ProviderUpdateType';
import { logger } from '../utils/logger';
import { wait } from '../utils/wait';
import { extensionConnectWithOverwrite } from './extensionConnectWithOverwrite';

const initializeMobileProvider = async ({
  checkInstallationOnAllCalls = false,
  communicationLayerPreference,
  injectProvider,
  shouldShimWeb3,
  platformManager,
  installer,
  sdk,
  remoteConnection,
  debug,
}: {
  communicationLayerPreference: CommunicationLayerPreference;
  checkInstallationOnAllCalls?: boolean;
  injectProvider?: boolean;
  shouldShimWeb3: boolean;
  sdk: MetaMaskSDK;
  platformManager: PlatformManager;
  installer: MetaMaskInstaller;
  remoteConnection?: RemoteConnection;
  debug: boolean;
}) => {
  // Setup stream for content script communication
  const metamaskStream = getPostMessageStream({
    name: ProviderConstants.INPAGE,
    target: ProviderConstants.CONTENT_SCRIPT,
    platformManager,
    communicationLayerPreference,
    remoteConnection,
  });

  const platformType = platformManager.getPlatformType();
  const dappInfo = sdk.options.dappMetadata;
  const sdkInfo = `Sdk/Javascript SdkVersion/${
    packageJson.version
  } Platform/${platformType} dApp/${dappInfo.url ?? dappInfo.name} dAppTitle/${
    dappInfo.name
  }`;

  let cachedAccountAddress: string | null = null;
  let cachedChainId: string | null = null;
  const storageManager = sdk.options.storage?.storageManager;

  // check if localStorage is available
  if (storageManager) {
    try {
      const cachedAddresses = await storageManager.getCachedAccounts();
      if (cachedAddresses.length > 0) {
        cachedAccountAddress = cachedAddresses[0];
      }
    } catch (err) {
      console.error(
        `[initializeMobileProvider] failed to get cached addresses: ${err}`,
      );
    }

    try {
      const cachedChain = await storageManager.getCachedChainId();
      if (cachedChain) {
        cachedChainId = cachedChain;
      }
    } catch (err) {
      console.error(
        `[initializeMobileProvider] failed to parse cached chainId: ${err}`,
      );
    }
  }

  logger(
    `[initializeMobileProvider] cachedAccountAddress: ${cachedAccountAddress}, cachedChainId: ${cachedChainId}`,
  );

  // Initialize provider object (window.ethereum)
  const shouldSetOnWindow = !(
    !injectProvider ||
    // Don't inject if it's non browser or RN
    platformType === PlatformType.NonBrowser ||
    platformType === PlatformType.ReactNative
  );

  // ethereum.init will automatically call metamask_getProviderState
  const ethereum = Ethereum.init({
    shouldSetOnWindow,
    connectionStream: metamaskStream,
    shouldShimWeb3,
  });

  let initializationOngoing = false;
  const setInitializing = (ongoing: boolean) => {
    initializationOngoing = ongoing;
  };

  const getInitializing = () => {
    return initializationOngoing;
  };

  const sendRequest = async (
    method: string,
    args: any,
    executeRequest: any,
    debugRequest: boolean,
  ) => {
    console.warn(`OOOOOOOO method=${method} `);
    if (initializationOngoing) {
      // make sure the active modal is displayed
      remoteConnection?.showActiveModal();

      let loop = getInitializing();
      while (loop) {
        logger(
          `[initializeMobileProvider: sendRequest()] waiting for initialization to complete`,
        );
        // Wait for already ongoing method that triggered installation to complete
        await wait(1000);
        loop = getInitializing() && !remoteConnection?.isAuthorized();
      }

      logger(
        `[initializeMobileProvider: sendRequest()] initial method completed -- prevent installation and call provider`,
      );
      // Previous init has completed, meaning we can safely interrup and call the provider.
      return executeRequest(...args);
    }

    const isInstalled = platformManager.isMetaMaskInstalled();
    // Also check that socket is connected -- otherwise it would be in inconherant state.
    const socketConnected = remoteConnection?.isConnected();

    const provider = Ethereum.getProvider();

    let selectedAddress: string | null = null;
    let chainId: string | null = null;

    selectedAddress = provider.getSelectedAddress() ?? cachedAccountAddress;
    chainId = provider.getChainId() || cachedChainId;

    // keep cached values for selectedAddress and chainId
    if (selectedAddress) {
      if (storageManager && selectedAddress !== cachedAccountAddress) {
        storageManager.persistAccounts([selectedAddress]).catch((err) => {
          console.error(
            `[initializeMobileProvider] failed to persist account: ${err}`,
          );
        });
      }
    }

    if (chainId) {
      cachedChainId = chainId;
      if (storageManager) {
        storageManager.persistChainId(chainId).catch((err) => {
          console.error(
            `[initializeMobileProvider] failed to persist chainId: ${err}`,
          );
        });
      }
    }

    logger('[initializeMobileProvider: sendRequest()]', {
      selectedAddress,
      chainId,
    });

    if (debugRequest) {
      logger(
        `[initializeMobileProvider: sendRequest()] method=${method} ongoing=${initializationOngoing} selectedAddress=${selectedAddress} isInstalled=${isInstalled} checkInstallationOnAllCalls=${checkInstallationOnAllCalls} socketConnected=${socketConnected}`,
      );
    }

    // Special case for eth_accounts to allow working with read-only RPC
    if (
      selectedAddress &&
      method.toLowerCase() === RPC_METHODS.ETH_ACCOUNTS.toLowerCase()
    ) {
      return [selectedAddress];
    }

    // Special case for eth_chainId to allow working with read-only RPC
    if (
      chainId &&
      method.toLowerCase() === RPC_METHODS.ETH_CHAINID.toLowerCase()
    ) {
      return chainId;
    }

    const ALLOWED_CONNECT_METHODS = [
      RPC_METHODS.ETH_REQUESTACCOUNTS,
      RPC_METHODS.WALLET_REQUESTPERMISSIONS,
      RPC_METHODS.METAMASK_CONNECTSIGN,
      RPC_METHODS.METAMASK_CONNECTWITH,
    ];

    // is it a readonly method with infura supported chain?
    const isReadOnlyMethod = !METHODS_TO_REDIRECT[method];
    const rpcEndpoint = sdk.options.readonlyRPCMap?.[chainId as `0x${string}`];
    if (rpcEndpoint && isReadOnlyMethod) {
      try {
        const params = args?.[0]?.params;

        // TODO: decide if we want external provider tracking
        // sdk.analytics?.send({
        //   event: TrackingEvents.SDK_RPC_REQUEST,
        //   params: { method, from: 'readonly' },
        // });
        const readOnlyResponse = await rpcRequestHandler({
          rpcEndpoint,
          sdkInfo,
          method,
          params: params || [],
        });

        if (debugRequest) {
          logger(`initializeProvider::ReadOnlyRPCResponse ${readOnlyResponse}`);
        }
        return readOnlyResponse;
      } catch (err) {
        // Log error and fallback to mobile provider
        console.warn(
          `[initializeMobileProvider: sendRequest()] method=${method} readOnlyRPCRequest failed:`,
          err,
        );
      }
    }

    if (
      (!isInstalled || (isInstalled && !socketConnected)) &&
      method !== RPC_METHODS.METAMASK_GETPROVIDERSTATE
    ) {
      const params = args?.[0]?.params || [];

      if (
        ALLOWED_CONNECT_METHODS.indexOf(method) !== -1 ||
        checkInstallationOnAllCalls
      ) {
        setInitializing(true);

        try {
          const installerPromise = installer.start({
            wait: false,
          });
          const receiveAuthorizedPromise = new Promise((resolve) => {
            remoteConnection?.getConnector().once(EventType.AUTHORIZED, () => {
              resolve(true);
            });
          });

          // Installer can be started in parallel with the request
          await Promise.race([installerPromise, receiveAuthorizedPromise]);
          setInitializing(false);
        } catch (installError) {
          setInitializing(false);

          if (PROVIDER_UPDATE_TYPE.EXTENSION === installError) {
            logger(
              `[initializeMobileProvider: sendRequest()] extension provider detect: re-create ${method} on the active provider`,
            );

            // Special case for metamask_connectSign, split the request in 2 parts (connect + sign)
            if (
              method.toLowerCase() ===
              RPC_METHODS.METAMASK_CONNECTSIGN.toLowerCase()
            ) {
              const accounts = (await sdk.getProvider()?.request({
                method: RPC_METHODS.ETH_REQUESTACCOUNTS,
                params: [],
              })) as string[];
              if (!accounts.length) {
                throw new Error(`SDK state invalid -- undefined accounts`);
              }

              return await sdk.getProvider()?.request({
                method: RPC_METHODS.PERSONAL_SIGN,
                params: [params[0], accounts[0]],
              });
            } else if (
              method.toLowerCase() ===
              RPC_METHODS.METAMASK_CONNECTWITH.toLowerCase()
            ) {
              const [rpc] = params;
              // Overwrite rpc method with correct account information
              return await extensionConnectWithOverwrite({
                method: rpc.method,
                sdk,
                params: rpc.params,
              });
            }

            logger(
              `[initializeMobileProvider: sendRequest()] sending '${method}' on active provider`,
              params,
            );
            // Re-create the query on the active provider
            return await sdk.getProvider()?.request({
              method,
              params,
            });
          }

          logger(
            `[initializeMobileProvider: sendRequest()] failed to start installer: ${installError}`,
          );

          throw installError;
        }

        // Initialize the request (otherwise the rpc call is not sent)
        const response = executeRequest(...args);

        // Wait for the provider to be initialized so we can process requests
        try {
          await new Promise((resolve, reject) => {
            remoteConnection?.getConnector().once(EventType.AUTHORIZED, () => {
              resolve(true);
            });

            // Also detect changes of provider
            sdk.once(
              EventType.PROVIDER_UPDATE,
              (type: PROVIDER_UPDATE_TYPE) => {
                logger(
                  `[initializeMobileProvider: sendRequest()] PROVIDER_UPDATE --- remote provider request interupted type=${type}`,
                );

                if (type === PROVIDER_UPDATE_TYPE.EXTENSION) {
                  reject(EventType.PROVIDER_UPDATE);
                } else {
                  reject(new Error('Connection Terminated'));
                }
              },
            );
          });
        } catch (err: unknown) {
          setInitializing(false);
          if (err === EventType.PROVIDER_UPDATE) {
            // Re-create the query on the active provider
            return await sdk.getProvider()?.request({
              method,
              params,
            });
          }
          throw err;
        }

        setInitializing(false);

        return response;
      } else if (platformManager.isSecure() && METHODS_TO_REDIRECT[method]) {
        // Should be connected to call f ==> redirect to RPCMS
        return executeRequest(...args);
      }

      if (sdk.isExtensionActive()) {
        // It means there was a switch of provider while waiting for initialization -- redirect to the extension.
        logger(
          `[initializeMobileProvider: sendRequest()] EXTENSION active - redirect request '${method}' to it`,
          args,
          params,
        );

        // redirect to extension
        return await sdk.getProvider()?.request({
          method,
          params,
        });
      }

      logger(
        `[initializeMobileProvider: sendRequest()] method=${method} --- skip --- not connected/installed`,
      );
      throw new Error(
        'MetaMask is not connected/installed, please call eth_requestAccounts to connect first.',
      );
    }

    try {
      const rpcResponse = await executeRequest(...args);
      logger(
        `[initializeMobileProvider: sendRequest()] method=${method} rpcResponse: ${rpcResponse}`,
      );
      return rpcResponse;
    } catch (error) {
      console.error(`[initializeMobileProvider: sendRequest()] error:`, error);
      throw error;
    }
  };

  // Wrap ethereum.request call to check if the user needs to install MetaMask
  const { request } = ethereum;
  // request<T>(args: RequestArguments): Promise<Maybe<T>>;
  ethereum.request = async (...args) => {
    return sendRequest(args?.[0].method, args, request, debug);
  };

  // send<T>(payload: SendSyncJsonRpcRequest): JsonRpcResponse<T>;
  const { send } = ethereum;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore // TODO remove support for deprecated method
  ethereum.send = async (...args) => {
    return sendRequest(args?.[0] as string, args, send, debug);
  };

  logger(`[initializeMobileProvider: sendRequest()] metamaskStream.start()`);
  metamaskStream.start();
  return ethereum;
};

export default initializeMobileProvider;
