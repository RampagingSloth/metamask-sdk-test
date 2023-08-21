import { RemoteCommunication } from '../../RemoteCommunication';
import { EventType } from '../../types/EventType';

/**
 * Processes the authorized message for a `RemoteCommunication` instance.
 *
 * When the `handleAuthorizedMessage` function is invoked, it performs the following actions:
 * 1. It updates the `authorized` property of the `RemoteCommunication` instance state to true. This marks the instance as authorized.
 * 2. Emits an `AUTHORIZED` event, which can be listened to by other parts of the application. This event notifies listeners that the instance has successfully been authorized.
 *
 * This function is typically used when the application receives an authorization confirmation, indicating that the necessary authentication and authorization checks have been successfully completed.
 *
 * @param instance The `RemoteCommunication` instance on which the authorized message is processed.
 */
export function handleAuthorizedMessage(instance: RemoteCommunication) {
  instance.state.authorized = true;
  instance.emit(EventType.AUTHORIZED);
}
