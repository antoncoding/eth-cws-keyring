const { EventEmitter } = require('events')
const ethUtil = require('ethereumjs-util')
const HDKey = require('hdkey')
const DELAY_BETWEEN_POPUPS = 1000
const cwsETH = require('@coolwallets/eth')
const TransportWebBle = require('@coolwallets/transport-web-ble')
const { Transaction } = require('ethereumjs-tx')

const type = 'CoolWalletS'

class CoolWalletSKeyring extends EventEmitter {
  constructor(opts = {}) {
    super()
    this.page = 0
    this.perPage = 5
    this.accounts = []
    this.hdk = new HDKey()
    this.transport = new TransportWebBle()
    this.ETH = new cwsETH(this.transport)
    this.deserialize(opts)
  }

  serialize() {
    return Promise.resolve({
      unlockedAccount: this.unlockedAccount,
      parentPublicKey: this.hdk.publicKey.toString('hex'),
      parentChainCode: this.hdk.chainCode.toString('hex'),
      appId: this.appId,
      appPirvateKey: this.appPrivateKey,
      appPublicKey: this.appPublicKey,
      accounts: this.accounts,
    })
  }

  deserialize(opts = {}) {
    this.unlockedAccount = opts.unlockedAccount
    this.hdk.publicKey = opts.parentPublicKey
    this.hdk.chainCode = opts.parentChainCode
    this.appId = opts.appId
    this.appPrivateKey = opts.appPrivateKey
    this.appPublicKey = opts.appPublicKey
    this.accounts = opts.accounts
    this.ETH = new cwsETH(this.transport, this.appPrivateKey, this.appId)
    return Promise.resolve()
  }

  connectWallet() {
    return new Promise((resolve, reject) => {
      if (this.transport.connected) resolve('already connected')
      this.transport.connect().then(
        _ => {
          resolve('connected')
        },
        error => {
          reject('connected to card error: ' + error)
        }
      )
    })
  }

  /**
   * Unlocked of CWS means you have access to all the public keys. (Not connected to device.)
   */
  isUnlocked() {
    return !!(this.hdk && this.hdk.publicKey)
  }

  /**
   * Get access to public keys.
   */
  unlock() {
    if (this.isUnlocked()) return Promise.resolve('already unlocked')
    return new Promise((resolve, reject) => {
      this.connectWallet().then(() => {
        this.ETH.getPublicKey(0)
          .then(payload => {
            this.hdk.publicKey = new Buffer(payload.parentPublicKey, 'hex')
            this.hdk.chainCode = new Buffer(payload.parentChainCode, 'hex')
            resolve('just unlocked')
          })
          .catch(e => {
            reject(new Error((e && e.toString()) || 'Unknown error'))
          })
      })
    })
  }

  setAccountToUnlock(index) {
    this.unlockedAccount = parseInt(index, 10)
  }

  addAccounts(n = 1) {
    return new Promise((resolve, reject) => {
      this.unlock()
        .then(_ => {
          const from = this.unlockedAccount
          const to = from + n
          this.accounts = []

          for (let i = from; i < to; i++) {
            const address = this._addressFromIndex(i).address
            this.accounts.push(address)
            this.page = 0
          }
          resolve(this.accounts)
        })
        .catch(e => {
          reject(e)
        })
    })
  }

  getFirstPage() {
    this.page = 0
    return this._getPage(1)
  }

  getNextPage() {
    return this._getPage(1)
  }

  getPreviousPage() {
    return this._getPage(-1)
  }

  _getPage(increment) {
    this.page += increment

    if (this.page <= 0) {
      this.page = 1
    }

    return new Promise((resolve, reject) => {
      this.unlock()
        .then(_ => {
          const from = (this.page - 1) * this.perPage
          const to = from + this.perPage

          const accounts = []

          for (let i = from; i < to; i++) {
            const { address, publicKey } = this._addressFromIndex(i)
            accounts.push({
              address: address,
              balance: null,
              index: i,
            })
            this.paths[ethUtil.toChecksumAddress(address)] = i
            this.pubkeys[i] = publicKey
          }
          resolve(accounts)
        })
        .catch(e => {
          reject(e)
        })
    })
  }

  getAccounts() {
    return Promise.resolve(this.accounts.slice())
  }

  removeAccount(address) {
    if (!this.accounts.map(a => a.toLowerCase()).includes(address.toLowerCase())) {
      throw new Error(`Address ${address} not found in this keyring`)
    }
    this.accounts = this.accounts.filter(a => a.toLowerCase() !== address.toLowerCase())
  }

  /**
   *
   * @param {string} address
   * @param {Transaction} tx
   */
  signTransaction(address, tx) {
    return new Promise((resolve, reject) => {
      this.connectWallet()
        .then(() => {
          this.unlock().then(status => {
            setTimeout(
              _ => {
                const { index, publicKey } = this._indexFromAddress(address)
                this.ETH.signTransaction(
                  {
                    nonce: this._normalize(tx.nonce),
                    gasPrice: this._normalize(tx.gasPrice),
                    gasLimit: this._normalize(tx.gasLimit),
                    to: this._normalize(tx.to),
                    value: this._normalize(tx.value),
                    data: this._normalize(tx.data),
                    chainId: tx._chainId,
                  },
                  index,
                  publicKey
                )
                  .then(hex => {
                    const signedTx = new Transaction(hex)
                    const addressSignedWith = ethUtil.toChecksumAddress(`0x${signedTx.from.toString('hex')}`)
                    const correctAddress = ethUtil.toChecksumAddress(address)
                    if (addressSignedWith !== correctAddress) {
                      reject(new Error('signature doesnt match the right address'))
                    }
                    resolve(signedTx)
                  })
                  .catch(e => {
                    reject(new Error((e && e.toString()) || 'Unknown error'))
                  })
              },
              status === 'just unlocked' ? DELAY_BETWEEN_POPUPS : 0
            )
          })
        })
        .catch(e => {
          reject(new Error((e && e.toString()) || 'Unknown error'))
        })
    })
  }

  signMessage(withAccount, message) {
    return new Promise((resolve, reject) => {
      this.unlock().then(_ => {
        this.connectWallet().then(_ => {
          let { index, publicKey } = this._indexFromAddress(withAccount)
          this.ETH.signMessage(message, index, publicKey).then(
            signature => {
              resolve(signature)
            },
            error => reject('signig error' + error)
          )
        })
      })
    })
  }

  signTypedData(withAccount, typedData) {
    return new Promise((resolve, reject) => {
      this.unlock().then(_ => {
        this.connectWallet().then(_ => {
          let { index, publicKey } = this._indexFromAddress(withAccount)
          this.ETH.signTypedData(typedData, index, publicKey).then(
            signature => {
              resolve(signature)
            },
            error => reject('signig error' + error)
          )
        })
      })
    })
  }

  exportAccount() {
    return Promise.reject(new Error('Not supported on this device'))
  }

  forgetDevice() {
    this.accounts = []
    this.hdk = new HDKey()
    this.page = 0
    this.unlockedAccount = 0
    this.paths = {}
    this.pubkeys = {}
  }

  /* PRIVATE METHODS */

  _normalize(buf) {
    return ethUtil.bufferToHex(buf).toString()
  }

  /**
   * @param {number} i index
   * @return { publicKey: string, address: string }
   */
  _addressFromIndex(i) {
    const pubkeyBuf = this.hdk.derive(`${i}`).publicKey
    let address = ethUtil.publicToAddress(pubkeyBuf, true).toString('hex')
    address = ethUtil.toChecksumAddress(address)
    return { address, publicKey: pubkeyBuf.toString('hex') }
  }

  _indexFromAddress(address) {
    const checksummedAddress = ethUtil.toChecksumAddress(address)
    let index = this.paths[checksummedAddress]
    if (typeof index === 'undefined') {
      for (let i = 0; i < MAX_INDEX; i++) {
        if (checksummedAddress === this._addressFromIndex(pathBase, i).address) {
          index = i
          break
        }
      }
    }

    if (typeof index === 'undefined') {
      throw new Error('Unknown address')
    }
    let publicKey = this.pubkeys[index]
    return { index, publicKey }
  }
}

CoolWalletSKeyring.type = type
module.exports = CoolWalletSKeyring
