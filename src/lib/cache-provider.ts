import NodeCache from 'node-cache'

export class CacheProvider {
  private cache: NodeCache

  constructor() {
    this.cache = new NodeCache({ stdTTL: 600, checkperiod: 200 })
  }

  instance() {
    return this.cache
  }
}
