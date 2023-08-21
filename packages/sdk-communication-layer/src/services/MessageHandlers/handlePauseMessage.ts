import { RemoteCommunication } from '../../RemoteCommunication';
import { ConnectionStatus } from '../../types/ConnectionStatus';
/**
 * Handles the pause message for a `RemoteCommunication` instance.
 *
 * When the system receives a pause message, this function updates the current state of the `RemoteCommunication` instance by:
 *
 * 1. Marking the communication as paused (`instance.state.paused = true`).
 * 2. Updating the connection status to `ConnectionStatus.PAUSED`.
 *
 * The pause functionality can be useful in situations where communication needs to be temporarily halted without terminating the connection. This can be due to various reasons, such as waiting for user input, network interruptions, or other operational considerations.
 *
 * @param instance The `RemoteCommunication` instance whose state needs to be updated in response to a pause message.
 */
export function handlePauseMessage(instance: RemoteCommunication) {
  instance.state.paused = true;
  instance.setConnectionStatus(ConnectionStatus.PAUSED);
}
