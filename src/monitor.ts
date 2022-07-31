'use strict'

import { EventEmitter } from 'events'

import WebProtocolHander from './protocols/web.js'
import TcpProtocolHander from './protocols/tcp.js'

import { Options } from 'got/dist/source/index.js'
import { MonitorError, MonitorHandler, MonitorResponse } from './protocols/index.js'

export interface WebProtocolOptions {
  url: string
  engine: 'got' | 'puppeteer'
  httpOptions: Options
  expect?: { contentSearch?: string; statusCode: number }
}

export interface TcpProtocolOptions {
  host: string
  port: number 
  options?: Record<string, any>
  expect?: Record<string, any>
}

export type SupportedProtocol = 'web' | 'tcp'
export type SupportedProtocolOptions = WebProtocolOptions | TcpProtocolOptions


export interface MonitorOptions {
    protocol: SupportedProtocol
    protocolOptions: SupportedProtocolOptions
    interval: number
}


const ProtocolHandlers: Record<SupportedProtocol, MonitorHandler> = {
  'web': new WebProtocolHander(),
  'tcp': new TcpProtocolHander(),
}

export type MonitorState = 'running' | 'waiting' | 'stopped'



export class Monitor extends EventEmitter {
  // Options
  readonly protocol: SupportedProtocol
  readonly protocolOptions: SupportedProtocolOptions
  readonly interval: number

  private _intervalHandler: NodeJS.Timeout | null
  private _intervalHandlerTicking: boolean

  constructor(opts: MonitorOptions, runImmediately: boolean = true) {
    super()

    this.protocol = opts.protocol
    this.protocolOptions = opts.protocolOptions
    this.interval = opts.interval ?? 30000  // User-specified or 30 Seconds default
  
    this._intervalHandler = null
    this._intervalHandlerTicking = false

    this.start(runImmediately)
  }

  
  public get isTicking() : boolean {
    return this._intervalHandlerTicking
  }

  private resetState(): void {
    if(this._intervalHandler) {
      clearInterval(this._intervalHandler)
    }
    
    this._intervalHandler = null
    this._intervalHandlerTicking = false
  }

  public start(force: boolean = false): void {
    if(this._intervalHandlerTicking  && !force) {
      return
    }
    this._intervalHandlerTicking = true

    // Ping on start
    this.emit('start', this)
    this.ping()

    // create an interval for regular pings
    this._intervalHandler = setInterval(() => { this.ping() }, this.interval)
  }

  public stop(): void {
    this.resetState()
    this.emit('stop', this)
  }

  public restart(): void {
    this.emit('restart', this)
    this.stop()
    this.start()
  }

  private ping() {
    process.nextTick(async () => {
      try {
        const response: MonitorResponse = await ProtocolHandlers[this.protocol].ping(this.protocolOptions)
        this.emit(response.event, this, response)
      } catch (err: any) {
        if (err instanceof MonitorError) {
          this.emit(err.response.event, this, err.response)
        } else {
          // Unexpected errors raised in MonitorHandler. Theoretically, should never get here!
          
          // Wrap the error in a MonitorResponse object, so event listeners can handle the error
          // similarly to how expected errors are handled.
          const response: MonitorResponse = {
            event: 'error',
            isUp: false,
            duration: 0,
            error: err
          }

          this.emit(response.event, this, response)
        }
      } finally {
        this.emit('ping', this)
        await Promise.resolve()
      }
    })
  }
}
