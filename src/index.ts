import { ethers } from 'ethers'

import { Comptroller } from './contracts'
import { PromServer, CacheProvider } from './lib'
import { RariComptroller__factory } from '../types/ethers-contracts'

import config from '../config.json'
import addresses from './contracts/addresses.json'

const CHECK_INTERVAL = 20 // minutes

// wait for ms
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(config.providerEth)

  const promServer = new PromServer(Number(config.port) || 9094)
  promServer.start()

  const cacheProvider = new CacheProvider()
  const rariComptroller = new Comptroller(
    provider,
    RariComptroller__factory.connect(addresses.rariComptroller, provider),
    cacheProvider.instance(),
  )

  for (;;) {
    config.wallets.forEach(async wallet => {
      const position = await rariComptroller.getRariBalance(wallet.address)
      promServer.setSupply(wallet.name, position.supplied)
      promServer.setBorrow(wallet.name, position.borrowed)
      promServer.setPercentage(wallet.name, (position.borrowed / position.supplied) * 100)
      console.log(
        wallet.name +
          ': $' +
          position.supplied.toLocaleString('en-US') +
          ' supplied / $' +
          position.borrowed.toLocaleString('en-US') +
          ' borrowed',
      )
    })
    await sleep(CHECK_INTERVAL * 60 * 1000)
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
