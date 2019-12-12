const { EventEmitter } = require('events')
const HDKey = require('hdkey')
const ethUtil = require('ethereumjs-util')
const type = 'CoolWalletS'
const BRIDGE_URL = 'https://noraliu0830.github.io/cws-web-flow/#/iframe'
const MAX_INDEX = 1000
const rlp = require('rlp')

class CoolWalletKeyRing extends EventEmitter {
  constructor(opts = {}) {
    super()
    this.bridgeUrl = null
    this.type = type
    this.page = 0
    this.perPage = 5
    this.unlockedAccount = 0
    this.hdk = new HDKey()
    this.paths = {}
    this.iframe = null
    this.deserialize(opts)
    this._setupIframe()
  }

  serialize() {
    return Promise.resolve({
      accounts: this.accounts,
      bridgeUrl: this.bridgeUrl,
      parentPublicKey: this.hdk.publicKey.toString('hex'),
      parentChainCode: this.hdk.chainCode.toString('hex')
    })
  }

  deserialize(opts = {}) {
    this.bridgeUrl = opts.bridgeUrl || BRIDGE_URL
    this.accounts = opts.accounts || []
    if (opts.parentPublicKey) this.hdk.publicKey = new Buffer(opts.parentPublicKey, 'hex')
    if (opts.parentChainCode) this.hdk.chainCode = new Buffer(opts.parentChainCode, 'hex')
    return Promise.resolve()
  }

  hasAccountKey() {
    const result = !!(this.hdk && this.hdk.publicKey)
    return result
  }

  setAccountToUnlock(index) {
    this.unlockedAccount = parseInt(index, 10)
  }

  unlock(addrIndex) {
    if (this.hasAccountKey() && typeof addrIndex === 'undefined') return Promise.resolve('already unlocked')
    if (this.hasAccountKey() && typeof addrIndex === 'number' ) {
      return this._addressFromIndex(addrIndex)
    } 
    // unlock: get publickey and chainCodes
    return new Promise((resolve, reject) => {
      addrIndex = addrIndex | 0
      this._sendMessage(
        {
          action: 'coolwallet-unlock',
          params: {
            addrIndex,
          },
        },
        ({ success, payload }) => {
          if (success) {
            this.hdk.publicKey = new Buffer(payload.parentPublicKey, 'hex')
            this.hdk.chainCode = new Buffer(payload.parentChainCode, 'hex')
            const address = this._addressFromPublicKey(Buffer.from(payload.publicKey, 'hex'))
            resolve(address) 
          } else {
            reject(payload.error || 'Unknown error')
          }
        }
      )
    })
  }

  addAccounts(n = 1) {
    return new Promise((resolve, reject) => {
      this.unlock()
        .then(async _ => {
          const from = this.unlockedAccount
          const to = from + n
          this.accounts = []
          for (let i = from; i < to; i++) {
            let address = await this.unlock(i)
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
    return this.__getPage(1)
  }

  getNextPage() {
    return this.__getPage(1)
  }

  getPreviousPage() {
    return this.__getPage(-1)
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

  // tx is an instance of the ethereumjs-transaction class.
  signTransaction(address, tx) {
    return new Promise((resolve, reject) => {
      this.unlock().then(_ => {
        const addrIndex = this._indexFromAddress(address)
        const publicKey = this._publicKeyFromIndex(addrIndex).toString('hex')
        const transaction = {
          to: this._normalize(tx.to),
          value: this._normalize(tx.value),
          data: this._normalize(tx.data),
          chainId: tx._chainId,
          nonce: this._normalize(tx.nonce),
          gasLimit: this._normalize(tx.gasLimit),
          gasPrice: this._normalize(tx.gasPrice),
        }

        this._sendMessage(
          {
            action: 'coolwallet-sign-transaction',
            params: {
              tx: transaction,
              addrIndex,
              publicKey
            },
          },
          ({ success, payload }) => {
            if (success) {
              const { v, r, s } = this.getSigFromPayload(payload)
              tx.v = v
              tx.r = r
              tx.s = s
              const valid = tx.verifySignature()
              if (valid) {
                resolve(tx)
              } else {
                reject(new Error('CoolWalletS: The transaction signature is not valid'))
              }
            } else {
              reject(new Error(payload.error || 'CoolWalletS: Unknown error while signing transaction'))
            }
          }
        )
      })
    })
  }

  getSigFromPayload(payload){
    const fields = rlp.decode(payload)
    return {
      v: fields[6],
      r: fields[7],
      s: fields[8]
    }
  }

  signMessage(withAccount, data) {
    return this.signPersonalMessage(withAccount, data)
  }

  // For personal_sign, we need to prefix the message:
  signPersonalMessage(withAccount, message) {
    return new Promise((resolve, reject) => {
      this.unlock().then(_ => {
        const addrIndex = this._indexFromAddress(withAccount)
        const publicKey = this._publicKeyFromIndex(addrIndex).toString('hex')
        this._sendMessage(
          {
            action: 'coolwallet-sign-personal-message',
            params: {
              addrIndex,
              message,
              publicKey
            },
          },
          ({ success, payload }) => {
            if (success) {
              resolve(payload)
            } else {
              reject(new Error(payload.error || 'CoolWalletS: Uknown error while signing message'))
            }
          }
        )
      })
    })
  }

  signTypedData(withAccount, typedData) {
    return new Promise((resolve, reject) => {
      this.unlock().then(_ => {
        const addrIndex = this._indexFromAddress(withAccount)
        const publicKey = this._publicKeyFromIndex(addrIndex).toString('hex')
        this._sendMessage(
          {
            action: 'coolwallet-sign-typed-data',
            params: {
              addrIndex,
              typedData,
              publicKey
            },
          },
          ({ success, payload }) => {
            if (success) {
              resolve(payload)
            } else {
              reject(new Error(payload.error || 'CoolWalletS: Uknown error while signing typed data'))
            }
          }
        )
      })
    })
  }

  exportAccount() {
    throw new Error('Not supported on this device')
  }

  forgetDevice() {
    this.accounts = []
    this.page = 0
    this.unlockedAccount = 0
    this.paths = {}
    this.hdk = new HDKey()
  }

  /* PRIVATE METHODS */

  _setupIframe() {
    this.iframe = document.createElement('iframe')
    this.iframe.src = this.bridgeUrl
    document.head.appendChild(this.iframe)
  }

  _sendMessage(msg, cb) {
    msg.target = 'CWS-IFRAME'
    this.iframe.contentWindow.postMessage(msg, '*')
    
    window.addEventListener('message', ({ data }) => {
      if (data && data.action && data.action === `${msg.action}-reply`) {
        cb(data)
      }
    })
  }

  __getPage(increment) {
    this.page += increment

    if (this.page <= 0) {
      this.page = 1
    }
    const from = (this.page - 1) * this.perPage
    const to = from + this.perPage

    return new Promise((resolve, reject) => {
      this.unlock().then(async _ => {
        let accounts = this._getAccounts(from, to)
        resolve(accounts)
      })
    })
  }

  _getAccounts(from, to) {
    const accounts = []

    for (let i = from; i < to; i++) {
      const address = this._addressFromIndex(i)
      accounts.push({
        address: address,
        balance: null,
        index: i,
      })
      this.paths[ethUtil.toChecksumAddress(address)] = i
    }
    return accounts
  }

  _padLeftEven(hex) {
    return hex.length % 2 !== 0 ? `0${hex}` : hex
  }

  _normalize(buf) {
    return this._padLeftEven(ethUtil.bufferToHex(buf).toLowerCase())
  }

  _publicKeyFromIndex(i){
    const dkey = this.hdk.derive(`m/${i}`)
    return dkey.publicKey
  }

  _addressFromIndex(i) {
    const pubkeyBuf = this._publicKeyFromIndex(i)
    return this._addressFromPublicKey(pubkeyBuf)
  }

  _addressFromPublicKey(publicKey) {
    const address = ethUtil.pubToAddress(publicKey, true).toString('hex')
    return ethUtil.toChecksumAddress(address)
  }

  _indexFromAddress(address) {
    const checksummedAddress = ethUtil.toChecksumAddress(address)
    let index = this.paths[checksummedAddress]
    if (typeof index === 'undefined') {
      for (let i = 0; i < MAX_INDEX; i++) {
        if (checksummedAddress === this._addressFromIndex(i)) {
          index = i
          break
        }
      }
    }

    if (typeof index === 'undefined') {
      throw new Error('Unknown address')
    }
    return index
  }
}

CoolWalletKeyRing.type = type
module.exports = CoolWalletKeyRing
