import { RemoteCommunication } from '../../RemoteCommunication';
import { ConnectionStatus } from '../../types/ConnectionStatus';
import { EventType } from '../../types/EventType';

/**
 * Creates and returns an event handler function for the "CLIENTS_WAITING" event. This handler manages state and operations when clients are in a waiting state within a `RemoteCommunication` instance.
 *
 * Upon client entering the waiting state:
 * 1. If debugging is enabled, logs diagnostic information such as the number of users waiting, current connection readiness, and if the originator connection has started automatically.
 * 2. Updates the `RemoteCommunication` instance state to "WAITING".
 * 3. Emits a "CLIENTS_WAITING" event to notify other parts of the system about the waiting clients. The number of waiting users is passed as an argument, which can be useful for managing UI states or triggering certain operations.
 * 4. If the originator connection started automatically, a timer is set based on the provided timeout (defaulting to 3 seconds if none is provided). When this timer expires:
 *    a. The connection's status is checked. If it hasn't transitioned to "ready", the connection status is updated to "TIMEOUT".
 *    b. The timer is cleared to prevent any further actions.
 *
 * @param instance The `RemoteCommunication` instance for which the event handler function is being created.
 * @returns A function that acts as the event handler for the "CLIENTS_WAITING" event, expecting the number of waiting users as its parameter.
 */
export function handleClientsWaitingEvent(instance: RemoteCommunication) {
  return (numberUsers: number) => {
    if (instance.state.debug) {
      console.debug(
        `RemoteCommunication::${instance.state.context}::on 'clients_waiting' numberUsers=${numberUsers} ready=${instance.state.ready} autoStarted=${instance.state.originatorConnectStarted}`,
      );
    }

    instance.setConnectionStatus(ConnectionStatus.WAITING);

    instance.emit(EventType.CLIENTS_WAITING, numberUsers);
    if (instance.state.originatorConnectStarted) {
      if (instance.state.debug) {
        console.debug(
          `RemoteCommunication::on 'clients_waiting' watch autoStarted=${instance.state.originatorConnectStarted} timeout`,
          instance.state.autoConnectOptions,
        );
      }

      const timeout = instance.state.autoConnectOptions?.timeout || 3000;
      const timeoutId = setTimeout(() => {
        if (instance.state.debug) {
          console.debug(
            `RemoteCommunication::on setTimeout(${timeout}) terminate channelConfig`,
            instance.state.autoConnectOptions,
          );
        }
        // Cleanup previous channelId
        // instance.state.storageManager?.terminate();
        instance.state.originatorConnectStarted = false;
        if (!instance.state.ready) {
          instance.setConnectionStatus(ConnectionStatus.TIMEOUT);
        }
        clearTimeout(timeoutId);
      }, timeout);
    }
  };
}
