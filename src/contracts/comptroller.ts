import { BigNumberish, ethers, utils } from 'ethers'
import NodeCache from 'node-cache'
import {
  LendingToken,
  LendingToken__factory,
  Oracle__factory,
  Token__factory,
} from '../../types/ethers-contracts'
import addresses from '../contracts/addresses.json'

export class Comptroller {
  private readonly provider: ethers.providers.JsonRpcProvider
  private readonly comptroller: ethers.Contract
  private cache: NodeCache

  constructor(
    provider: ethers.providers.JsonRpcProvider,
    comptroller: ethers.Contract,
    cache: NodeCache,
  ) {
    this.provider = provider
    this.comptroller = comptroller
    this.cache = cache
  }

  async getRariBalance(account: string) {
    const assets = await this.comptroller.getAssetsIn(account)
    let totalSupplied = 0
    let totalBorrowed = 0
    let totalLimit = 0

    for (let i = 0; i < assets.length; i++) {
      const assetInstance = LendingToken__factory.connect(assets[i], this.provider)
      const balance = this.formatUnits(await assetInstance.balanceOf(account), 8)

      const underlying = await this.getUnderlying(assetInstance)
      const underlyingDecimals = await this.getDecimals(underlying)

      const exchangeRate = this.formatUnits(
        await assetInstance.exchangeRateStored(),
        underlyingDecimals + 10,
      )
      const supplyBalance = balance * exchangeRate
      const borrowBalance = this.formatUnits(
        await assetInstance.borrowBalanceStored(account),
        underlyingDecimals,
      )

      const market = await this.getMarket(assetInstance.address)
      const underlyingPrice = await this.getPrice(underlying)

      const usdSupplied = supplyBalance * underlyingPrice
      const usdBorrowed = borrowBalance * underlyingPrice
      if (market.isListed) {
        totalLimit += usdSupplied * market.collateralFactor
      }
      totalSupplied += usdSupplied
      totalBorrowed += usdBorrowed
    }
    return { supplied: totalSupplied, borrowed: totalBorrowed, limit: totalLimit }
  }

  formatUnits(value: BigNumberish, decimals: number) {
    return parseFloat(utils.formatUnits(value, decimals))
  }

  async getDecimals(address: string) {
    const cacheKey = 'decimals_' + address.toLowerCase()
    const cachedValue = this.cache.get(cacheKey)
    if (cachedValue == undefined) {
      const token = Token__factory.connect(address, this.provider)
      const decimals: number = await token.decimals()
      this.cache.set(cacheKey, decimals, 0) // 0 = infinite ttl
      return decimals
    } else {
      return Number(cachedValue)
    }
  }

  async getUnderlying(asset: LendingToken) {
    const cacheKey = 'underlying_' + asset.address.toLowerCase()
    const cachedValue = this.cache.get(cacheKey)
    if (cachedValue == undefined) {
      let underlying: string = await asset.underlying()
      if (underlying == addresses.NULL_ADDRESS) underlying = addresses.WETH
      this.cache.set(cacheKey, underlying, 0) // 0 = infinite ttl
      return underlying
    } else {
      return String(cachedValue)
    }
  }

  async getPrice(address: string) {
    const cacheKey = 'price_' + address.toLowerCase()
    const cachedValue = this.cache.get(cacheKey)
    if (cachedValue == undefined) {
      const oracle = Oracle__factory.connect(addresses.oracle, this.provider)
      const tokenPriceInEth = this.formatUnits(await oracle.price(address), 18)
      const ethUsdPrice = 1 / this.formatUnits(await oracle.price(addresses.USDC), 18)
      const tokenPrice = tokenPriceInEth * ethUsdPrice
      this.cache.set(cacheKey, tokenPrice)
      return tokenPrice
    } else {
      return Number(cachedValue)
    }
  }

  async getMarket(address: string) {
    const cacheKey = 'markets_' + address.toLowerCase()
    const cachedValue: { isListed: boolean; collateralFactor: number } | undefined = this.cache.get(
      cacheKey,
    )
    if (cachedValue == undefined) {
      const markets = await this.comptroller.markets(address)
      const market: { isListed: boolean; collateralFactor: number } = {
        isListed: markets.isListed || false,
        collateralFactor: this.formatUnits(markets.collateralFactorMantissa, 18),
      }
      this.cache.set(cacheKey, market)
      return market
    } else {
      return cachedValue
    }
  }
}
