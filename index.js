const { EventEmitter } = require('events')
const ethUtil = require('ethereumjs-util')
const HDKey = require('hdkey')
const DELAY_BETWEEN_POPUPS = 1000
import cwsETH from 'cws-eth'
import TransportWebBle from 'cws-web-ble'
const type = 'CoolWalletS'

class CoolWalletSKeyring extends EventEmitter {
  constructor(opts = {}) {
    super()
    this.page = 0
    this.perPage = 5
    this.accounts = []
    this.hdk = new HDKey()
    this.transport = new TransportWebBle()
    //
    this.ETH = new cwsETH()
    //
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
        () => {
          resolve('connected')
        },
        error => {
          reject('connected to card error: ' + error)
        }
      )
    })
  }

  isUnlocked() {
    return !!(this.hdk && this.hdk.publicKey)
  }

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
            const address = this._addressFromIndex(i)
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
            const address = this._addressFromIndex(i)
            accounts.push({
              address: address,
              balance: null,
              index: i,
            })
            this.paths[ethUtil.toChecksumAddress(address)] = i
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

  // tx is an instance of the ethereumjs-transaction class.
  signTransaction(address, tx) {
    return new Promise((resolve, reject) => {
      this.connectWallet()
        .then(_ => {
          this.unlock().then(status => {
            setTimeout(
              _ => {
                this.ETH.signTransaction(payload, this._indexFromAddress(address))
                  .then(response => {
                    if (response.success) {
                      tx.v = response.payload.v
                      tx.r = response.payload.r
                      tx.s = response.payload.s

                      const signedTx = new Transaction(tx)

                      const addressSignedWith = ethUtil.toChecksumAddress(`0x${signedTx.from.toString('hex')}`)
                      const correctAddress = ethUtil.toChecksumAddress(address)
                      if (addressSignedWith !== correctAddress) {
                        reject(new Error('signature doesnt match the right address'))
                      }

                      resolve(signedTx)
                    } else {
                      reject(new Error((response.payload && response.payload.error) || 'Unknown error'))
                    }
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

  signMessage(withAccount, data) {
    return this.signPersonalMessage(withAccount, data)
  }

  // For personal_sign, we need to prefix the message:
  signPersonalMessage(withAccount, message) {
    return new Promise((resolve, reject) => {
      this.unlock()
        .then(status => {
          console.log('what?')
        })
        .catch(e => {
          console.log('Error while trying to sign a message ', e)
          reject(new Error((e && e.toString()) || 'Unknown error'))
        })
    })
  }

  signTypedData(withAccount, typedData) {
    // Waiting on trezor to enable this
    return Promise.reject(new Error('Not supported on this device'))
  }

  exportAccount(address) {
    return Promise.reject(new Error('Not supported on this device'))
  }

  forgetDevice() {
    this.accounts = []
    this.hdk = new HDKey()
    this.page = 0
    this.unlockedAccount = 0
    this.paths = {}
  }

  /* PRIVATE METHODS */

  _normalize(buf) {
    return ethUtil.bufferToHex(buf).toString()
  }

  _addressFromIndex(i) {
    const dkey = this.hdk.derive(`${i}`)
    const address = ethUtil.publicToAddress(dkey.publicKey, true).toString('hex')
    return ethUtil.toChecksumAddress(address)
  }

  _indexFromAddress(address) {
    const checksummedAddress = ethUtil.toChecksumAddress(address)
    let index = this.paths[checksummedAddress]
    if (typeof index === 'undefined') {
      for (let i = 0; i < MAX_INDEX; i++) {
        if (checksummedAddress === this._addressFromIndex(pathBase, i)) {
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

CoolWalletSKeyring.type = type
module.exports = CoolWalletSKeyring
