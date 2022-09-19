const Bip39 = require('bip39');
const HDWalletProvider = require('@truffle/hdwallet-provider');

class HDWallet extends HDWalletProvider {  
  constructor(mnemonic) {
    super(mnemonic, 'https://mainnet.infura.io/v3/1');
  }
  
  getAccounts() {
    let accounts = [];
    for (const address in this.wallets) {
      const wallet = this.wallets[address];
      accounts.push({private_key: wallet.getPrivateKeyString(), public_key: wallet.getAddressString()});
    }
    return accounts;
  }
}

// truffle exec shell/account.js --network rinkeby
module.exports = async function(callback) {
  await createAccounts();
  
  callback();
}

async function createAccounts() {
  const mnemonic = Bip39.generateMnemonic();
  console.log({mnemonic});
  
  const hdWallet = new HDWallet(mnemonic);
  const accounts = hdWallet.getAccounts();
  console.log({accounts});
}
