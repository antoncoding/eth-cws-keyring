import CoolWalletKeyRing from '../index';
import HDKey from 'hdkey';
import { Transaction } from 'ethereumjs-tx';

const fakeAccounts = [
  '0xF30952A1c534CDE7bC471380065726fa8686dfB3',
  '0x44fe3Cf56CaF651C4bD34Ae6dbcffa34e9e3b84B',
  '0x8Ee3374Fa705C1F939715871faf91d4348D5b906',
  '0xEF69e24dE9CdEe93C4736FE29791E45d5D4CFd6A',
  '0xC668a5116A045e9162902795021907Cb15aa2620',
  '0xbF519F7a6D8E72266825D770C60dbac55a3baeb9',
  '0x0258632Fe2F91011e06375eB0E6f8673C0463204',
  '0x4fC1700C0C61980aef0Fb9bDBA67D8a25B5d4335',
  '0xeEC5D417152aE295c047FB0B0eBd7c7090dDedEb',
  '0xd3f978B9eEEdB68A38CF252B3779afbeb3623fDf',
  '0xd819fE2beD53f44825F66873a159B687736d3092',
  '0xE761dA62f053ad9eE221d325657535991Ab659bD',
  '0xd4F1686961642340a80334b5171d85Bbd390c691',
  '0x6772C4B1E841b295960Bb4662dceD9bb71726357',
  '0x41bEAD6585eCA6c79B553Ca136f0DFA78A006899',
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

const mockSendMessage = jest.fn(({ action, params }, callback) => {
  switch (action) {
    case 'coolwallet-unlock': {
      callback({
        success: true,
        payload: {
          parentChainCode: '9452b549be8cea3ecb7a84bec10dcfd94afe4d129ebfd3b3cb58eedf394ed271',
          parentPublicKey: '024d902e1a2fc7a8755ab5b694c575fce742c48d9ff192e63df5193e4c7afe1f9c',
          publicKey: '031c0517fff3d483f06ca769bd2326bf30aca1c4de278e676e6ef760c3301244c6',
        },
      });
    }
  }
  callback();
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
      parentChainCode: '9452b549be8cea3ecb7a84bec10dcfd94afe4d129ebfd3b3cb58eedf394ed271',
      parentPublicKey: '024d902e1a2fc7a8755ab5b694c575fce742c48d9ff192e63df5193e4c7afe1f9c',
    });
    const output = await keyring.serialize();
    expect(output.parentChainCode).toBe('9452b549be8cea3ecb7a84bec10dcfd94afe4d129ebfd3b3cb58eedf394ed271');
    expect(output.parentPublicKey).toBe('024d902e1a2fc7a8755ab5b694c575fce742c48d9ff192e63df5193e4c7afe1f9c');
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
