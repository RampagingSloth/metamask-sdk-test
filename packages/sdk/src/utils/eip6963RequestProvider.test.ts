import { BaseProvider } from '@metamask/providers';
import {
  EIP6963EventNames,
  eip6963RequestProvider,
  EIP6963ProviderInfo,
  EIP6963ProviderDetail,
} from './eip6963RequestProvider';

describe('eip6963RequestProvider', () => {
  beforeEach(() => {
    global.window = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    } as any;

    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should reject after timeout', async () => {
    const requestProviderPromise = eip6963RequestProvider();

    jest.advanceTimersByTime(501);

    await expect(requestProviderPromise).rejects.toThrow(
      'eip6963RequestProvider timed out',
    );
  });

  it('should resolve with valid provider', async () => {
    const mockProvider: BaseProvider = {} as BaseProvider;
    const mockInfo: EIP6963ProviderInfo = {
      uuid: 'test-uuid',
      name: 'MetaMask Main',
      icon: 'icon-path',
      rdns: 'io.metamask',
    };
    const mockEventDetail: EIP6963ProviderDetail = {
      info: mockInfo,
      provider: mockProvider,
    };

    (window.addEventListener as jest.Mock).mockImplementationOnce(
      (eventName, callback) => {
        if (eventName === EIP6963EventNames.Announce) {
          callback({
            type: EIP6963EventNames.Announce,
            detail: mockEventDetail,
          });
        }
      },
    );

    const requestProviderPromise = await eip6963RequestProvider();

    expect(requestProviderPromise).toBe(mockProvider);
  });
});
