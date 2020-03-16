import CoolWalletKeyRing from '../index';
import HDKey from 'hdkey';
import { Transaction } from 'ethereumjs-tx';

const fakeAccounts = [
  '0xbAF99eD5b5663329FA417953007AFCC60f06F781',
  '0x0644De2A0Cf3f11Ef6Ad89C264585406Ea346a96',
  '0xB2F8613E310e5431eb4f2E22F5c85AF407D5C1C5',
  '0x3d505D598a365Ce0889ee8f97D0860da4CAdA96c',
  '0x88744E3733d1A5Aeb5cb7bD0B9eaAC470A36807D',
  '0x19D515A1a8F1F249d8098A2fD5c6B7Aa7B05dA1f',
  '0xBff22492cB6E771cf8633B3DEFc89FF883b3be63',
  '0x1E6749E5Ec9390F3C68BF9a35D12b5c05058B08f',
  '0x87b4dF4c8d2EE0249Da25fabB1Dfc1500a64F9f7',
  '0xEc9064De11CFdDb8B46E8cA22Db8Db0d566899cE',
];

const fakeXPubKey =
  'xpub6FnCn6nSzZAw5Tw7cgR9bi15UV96gLZhjDstkXXxvCLsUXBGXPdSnLFbdpq8p9HmGsApME5hQTZ3emM2rnY5agb9rXpVGyy3bdW6EEgAtqt';
const fakeHdKey = HDKey.fromExtendedKey(fakeXPubKey);
const fakeTransaction = new Transaction({
  chainId: 1,
  nonce: '0x31b',
  gasPrice: '0xb2d05e00',
  gasLimit: '0x520c',
  to: '0x0644De2A0Cf3f11Ef6Ad89C264585406Ea346a96',
  value: '0xde0b6b3a7640000',
  data: '0x00',
});

let keyring;

const fakeMessageSignature = '0xmessagesignature';
const fakeTypeDataSignature = '0xTypedDataSignature';
const unexistingAccount = '0x0000000000000000000000000000000000000000';

const mockSendMessage = jest.fn(({ action }, callback) => {
  switch (action) {
    case 'coolwallet-unlock': {
      callback({
        success: true,
        payload: {
          parentChainCode: 'cfa8134ff19fd1c746233f7090439a11cc76e85fb2ca647534ad1f945aa642a9',
          parentPublicKey: '0389a94efa3e5384a4cc3fc01a368ce3e10bb0883f6f61a32c58fe6e6b089f6dc2',
          publicKey: '033a057e1f19ea73423bd75f4d391dd28145636081bf0c2674f89fd6d04738f293',
        },
      });
    }
    case 'coolwallet-sign-transaction': {
      callback({
        success: true,
        payload:
          '0xf86e82031b85012a05f20082520c940644de2a0cf3f11ef6ad89c264585406ea346a96880de0b6b3a76400008025a07cce23b352f3c1f11ef4833e76b3b0cb14ca17bb0097d197b307690a551d19eea0156703269448e84d2a82e07531375896fd6fc6e0478cdda876315611d4cad697',
      });
    }
    case 'coolwallet-sign-personal-message': {
      callback({
        success: true,
        payload: fakeMessageSignature,
      });
    }
    case 'coolwallet-sign-typed-data': {
      callback({
        success: true,
        payload: fakeTypeDataSignature,
      });
    }
    default: {
      callback({
        success: false,
        payload: { error: 'Unmocked function' },
      });
    }
  }
});

beforeEach(async function() {
  keyring = new CoolWalletKeyRing();
  keyring.hdk = fakeHdKey;
  keyring._sendMessage = mockSendMessage;
});

describe('keyring type', () => {
  it('keyring vault', () => {
    expect(CoolWalletKeyRing.type).toBe('CoolWalletS');
    expect(keyring.type).toBe('CoolWalletS');
    expect(typeof keyring.type).toBe('string');
  });
});

describe('constructor', function() {
  it('constructs', async () => {
    const t = new CoolWalletKeyRing();
    expect(typeof t).toBe('object');
    const accounts = await t.getAccounts();
    expect(Array.isArray(accounts)).toBe(true);
  });
});

describe('serializes', () => {
  it('serializes an instance', async () => {
    const output = await keyring.serialize();
    expect(typeof output.parentChainCode).toBe('string');
    expect(typeof output.parentPublicKey).toBe('string');
    expect(output.page).toBe(0);
    expect(Array.isArray(output.accounts)).toBe(true);
    expect(output.accounts.length).toBe(0);
  });
});

describe('deserialize', () => {
  it('serializes what it deserializes', async () => {
    await keyring.deserialize({
      page: 10,
      accounts: [],
      bridgeUrl: 'https://coolbitx-technology.github.io/coolwallet-connect/#/iframe',
      parentChainCode: 'cfa8134ff19fd1c746233f7090439a11cc76e85fb2ca647534ad1f945aa642a9',
      parentPublicKey: '0389a94efa3e5384a4cc3fc01a368ce3e10bb0883f6f61a32c58fe6e6b089f6dc2',
    });
    const output = await keyring.serialize();
    expect(output.parentChainCode).toBe('cfa8134ff19fd1c746233f7090439a11cc76e85fb2ca647534ad1f945aa642a9');
    expect(output.parentPublicKey).toBe('0389a94efa3e5384a4cc3fc01a368ce3e10bb0883f6f61a32c58fe6e6b089f6dc2');
    expect(output.page).toBe(10);
    expect(Array.isArray(output.accounts)).toBe(true);
    expect(output.accounts.length).toBe(0);
  });
});

describe('hasAccountKey', () => {
  it('should return true if we have a public key', () => {
    const hasAccountKey = keyring.hasAccountKey();
    expect(hasAccountKey).toBe(true);
  });
});

describe('unlock', () => {
  it('should resolve if we have a public key', async () => {
    await keyring.unlock();
  });

  it('should call _sendMessage if we dont have a public key', async () => {
    keyring.hdk = new HDKey();
    await keyring.unlock();
    expect(keyring._sendMessage).toHaveBeenCalled();
  });
});

describe('setAccountToUnlock', function() {
  it('should set unlockedAccount', function() {
    keyring.setAccountToUnlock(3);
    expect(keyring.unlockedAccount).toBe(3);
  });
});

describe('addAccounts', () => {
  describe('with no arguments', () => {
    it('returns a single account', async () => {
      keyring.setAccountToUnlock(0);
      const accounts = await keyring.addAccounts();
      expect(accounts.length).toBe(1);
    });
  });

  describe('with a numeric argument', () => {
    it('returns that number of accounts', async () => {
      keyring.setAccountToUnlock(0);
      const accounts = await keyring.addAccounts(5);
      expect(accounts.length).toBe(5);
    });

    it('returns the expected accounts', async () => {
      keyring.setAccountToUnlock(0);
      const accounts = await keyring.addAccounts(3);
      expect(accounts[0]).toBe(fakeAccounts[0]);
      expect(accounts[1]).toBe(fakeAccounts[1]);
      expect(accounts[2]).toBe(fakeAccounts[2]);
    });
  });
});

describe('removeAccount', function() {
  describe('if the account exists', function() {
    it('should remove that account', async () => {
      keyring.setAccountToUnlock(0);
      const accounts = await keyring.addAccounts();

      expect(accounts.length).toBe(1);
      keyring.removeAccount(fakeAccounts[0]);
      const accountsAfterRemoval = await keyring.getAccounts();
      expect(accountsAfterRemoval.length).toBe(0);
    });
  });

  describe('if the account does not exist', function() {
    it('should throw an error', function() {
      expect(
        jest.fn(() => {
          keyring.removeAccount(unexistingAccount);
        })
      ).toThrow(`Address ${unexistingAccount} not found in this keyring`);
    });
  });
});

describe('getFirstPage', function() {
  it('should set the currentPage to 1', async function() {
    await keyring.getFirstPage();
    expect(keyring.page).toBe(1);
  });

  it('should return the list of accounts for current page', async function() {
    const accounts = await keyring.getFirstPage();

    expect(accounts.length).toBe(keyring.perPage);
    expect(accounts[0].address).toBe(fakeAccounts[0]);
    expect(accounts[1].address).toBe(fakeAccounts[1]);
    expect(accounts[2].address).toBe(fakeAccounts[2]);
    expect(accounts[3].address).toBe(fakeAccounts[3]);
    expect(accounts[4].address).toBe(fakeAccounts[4]);
  });
});

describe('getNextPage', function() {
  it('should return the list of accounts for current page', async () => {
    const accounts = await keyring.getNextPage();
    expect(accounts.length).toBe(keyring.perPage);
    expect(accounts[0].address).toBe(fakeAccounts[0]);
    expect(accounts[1].address).toBe(fakeAccounts[1]);
    expect(accounts[2].address).toBe(fakeAccounts[2]);
    expect(accounts[3].address).toBe(fakeAccounts[3]);
    expect(accounts[4].address).toBe(fakeAccounts[4]);
  });

  it('should be able to advance to the next page', async () => {
    // manually advance 1 page
    await keyring.getNextPage();

    const accounts = await keyring.getNextPage();
    expect(accounts.length).toBe(keyring.perPage);
    expect(accounts[0].address).toBe(fakeAccounts[keyring.perPage + 0]);
    expect(accounts[1].address).toBe(fakeAccounts[keyring.perPage + 1]);
    expect(accounts[2].address).toBe(fakeAccounts[keyring.perPage + 2]);
    expect(accounts[3].address).toBe(fakeAccounts[keyring.perPage + 3]);
    expect(accounts[4].address).toBe(fakeAccounts[keyring.perPage + 4]);
  });
});

describe('getPreviousPage', function() {
  it('should return the list of accounts for current page', async function() {
    // manually advance 1 page
    await keyring.getNextPage();
    const accounts = await keyring.getPreviousPage();

    expect(accounts.length).toBe(keyring.perPage);
    expect(accounts[0].address).toBe(fakeAccounts[0]);
    expect(accounts[1].address).toBe(fakeAccounts[1]);
    expect(accounts[2].address).toBe(fakeAccounts[2]);
    expect(accounts[3].address).toBe(fakeAccounts[3]);
    expect(accounts[4].address).toBe(fakeAccounts[4]);
  });

  it('should be able to go back to the previous page', async function() {
    // manually advance 1 page
    await keyring.getNextPage();
    const accounts = await keyring.getPreviousPage();

    expect(accounts.length).toBe(keyring.perPage);
    expect(accounts[0].address).toBe(fakeAccounts[0]);
    expect(accounts[1].address).toBe(fakeAccounts[1]);
    expect(accounts[2].address).toBe(fakeAccounts[2]);
    expect(accounts[3].address).toBe(fakeAccounts[3]);
    expect(accounts[4].address).toBe(fakeAccounts[4]);
  });
});

describe('getAccounts', function() {
  const accountIndex = 5;
  let accounts = [];
  beforeEach(async function() {
    keyring.setAccountToUnlock(accountIndex);
    await keyring.addAccounts();
    accounts = await keyring.getAccounts();
  });

  it('returns an array of accounts', function() {
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBe(1);
  });

  it('returns the expected', function() {
    const expectedAccount = fakeAccounts[accountIndex];
    expect(accounts[0]).toBe(expectedAccount);
  });
});

describe('signTransaction', function() {
  describe('sign with invalid account', () => {
    it('should throw unknown address error', async () => {
      await expect(
        keyring.signTransaction(unexistingAccount, fakeTransaction)
      ).rejects.toThrow('Unknown address');
    });
  });

  describe('sign with valid account', function() {
    it('should send signTransaction command', async () => {
      const tx = await keyring.signTransaction(fakeAccounts[0], fakeTransaction);
      expect(keyring._sendMessage).toHaveBeenCalled();
      expect(tx.verifySignature()).toBe(true);
    });
  });
});

describe('signMessage', function() {
  describe('sign with invalid account', () => {
    it('should throw unkown address error', async () => {
      await expect(
        keyring.signMessage(unexistingAccount, 'message')
      ).rejects.toThrow('Unknown address');
    });
  });

  describe('sign with valid account', function() {
    it('should send signMessage command', async () => {
      const signature = await keyring.signMessage(fakeAccounts[0], 'some msg');
      expect(keyring._sendMessage).toHaveBeenCalled();
      expect(signature).toBe(fakeMessageSignature);
    });
  });
});

describe('signTypedData', function () {
  describe('sign with invalid account', () => {
    it('should throw unkown address error', async () => {
      await expect(
        keyring.signTypedData(unexistingAccount, {})
      ).rejects.toThrow('Unknown address');
    });
  });

  describe('sign with valid account', function() {
    it('should send signTypedData command', async () => {
      const signature = await keyring.signTypedData(fakeAccounts[0], {});
      expect(keyring._sendMessage).toHaveBeenCalled();
      expect(signature).toBe(fakeTypeDataSignature);
    });
  });
})

describe('exportAccount', function () {
  it('should throw an error because it is not supported', () => {
    expect(keyring.exportAccount).toThrow('Not supported on this device');
  })
})

describe('forgetDevice', function () {
  it('should clear the content of the keyring', async () => {
      // Add an account
      keyring.setAccountToUnlock(0)
      await keyring.addAccounts()

      // Wipe the keyring
      keyring.forgetDevice()
      const accounts = await keyring.getAccounts()
      expect(accounts.length).toBe(0)
  })
})