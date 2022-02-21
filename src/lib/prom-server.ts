import express from 'express'
import promClient from 'prom-client'

export class PromServer {
  private port: number
  private register: promClient.Registry
  private server: express.Express
  private supplyMetric: promClient.Gauge<'wallet'>
  private borrowMetric: promClient.Gauge<'wallet'>
  private limitMetric: promClient.Gauge<'wallet'>
  private limitPercentageMetric: promClient.Gauge<'wallet'>

  constructor(port = 9094) {
    this.port = port
    this.register = new promClient.Registry()
    this.server = express()
    this.supplyMetric = new promClient.Gauge({
      name: 'supply',
      help: 'deposited amount',
      registers: [this.register],
      labelNames: ['wallet'],
    })
    this.borrowMetric = new promClient.Gauge({
      name: 'borrow',
      help: 'borrowed amount',
      registers: [this.register],
      labelNames: ['wallet'],
    })
    this.limitMetric = new promClient.Gauge({
      name: 'borrow_limit',
      help: 'borrow limit amount',
      registers: [this.register],
      labelNames: ['wallet'],
    })
    this.limitPercentageMetric = new promClient.Gauge({
      name: 'borrow_limit_percent',
      help: 'borrowed percentage',
      registers: [this.register],
      labelNames: ['wallet'],
    })
  }

  async start() {
    // Enable collection of default metrics
    promClient.collectDefaultMetrics({
      register: this.register,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5], // These are the default buckets.
    })

    this.server.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', this.register.contentType)
        res.end(await this.register.metrics())
      } catch (ex) {
        res.status(500).end(ex)
      }
    })

    this.server.listen(this.port)
    console.log(`Server listening on ${this.port}, metrics exposed on /metrics endpoint`)
  }

  setSupply(wallet: string, amount: number) {
    this.supplyMetric.set({ wallet }, amount)
  }

  setBorrow(wallet: string, amount: number) {
    this.borrowMetric.set({ wallet }, amount)
  }

  setLimit(wallet: string, amount: number) {
    this.limitMetric.set({ wallet }, amount)
  }

  setLimitPercentage(wallet: string, amount: number) {
    this.limitPercentageMetric.set({ wallet }, amount)
  }
}
