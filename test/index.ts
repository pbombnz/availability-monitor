/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
'use strict';

import { expect } from 'chai'
import nock from 'nock'
import net from 'net'
import TcpServer from './tcpServer'
import Monitor, { WebProtocolOptions } from '../src/monitor'
import { Response } from 'got/dist/source';
import puppeteer from 'puppeteer'
import { MonitorResponse } from '../src/protocols';

let tcpServer: net.Server


describe('Monitor', function () {
  before(function () {
    nock('https://testing.com')
      .persist()
      .get('/must-pass')
      .reply(200, 'page is up');

    nock('https://testing.com')
      .persist()
      .get('/test-redirect')
      .reply(301, 'page has be redirected up', {
        'Location': 'https://testing.com/must-pass'
      })
      .get('/must-pass')
      .reply(200, 'page is up');

    nock('https://testing.com')
      .persist()
      .get('/not-active')
      .reply(200, 'page is up');

    nock('https://testing.com')
      .persist()
      .get('/must-fail')
      .reply(500, 'page is up');

    nock('https://testing.com')
      .persist()
      .get('/test-http-options/users')
      .reply(301, 'page is up');

    nock('https://testing.com')
      .persist()
      .post('/users')
      .reply(200, (uri, requestBody) => requestBody);

    nock('https://testing.com')
      .persist()
      .get('/timeout')
      .delay(5000)
      .reply(200, 'Page is up');
    
    nock('https://testing.com')
      .persist()
      .get('/content-search')
      .reply(200, 'The quick brown fox jumps over the lazy dog');
      
    tcpServer = TcpServer;
  })

  it('web/got - should pass', function (done) {
    this.timeout(10000)

    let ping = new Monitor({
      protocol: 'web',
      protocolOptions: {
        engine: 'got',
        url: 'https://testing.com/must-pass',
        httpOptions: {}
      },
      interval: 500
    })

    ping.on('up', (monitor: Monitor, response: MonitorResponse) => {
      const res = response.data
      const isTicking = monitor.isTicking

      expect(isTicking).to.equal(true)
      expect(res.statusCode).to.equal(200)
      // check state props
      expect((ping.protocolOptions as WebProtocolOptions).url).to.be.equal('https://testing.com/must-pass')
      expect(monitor.interval).to.equal(500)
      ping.stop()
      done()
    })

    ping.on('down', (monitor: Monitor, response: MonitorResponse) => {
      ping.stop()
      done(new Error('Should have never got here'))
    })
  })

  it('web/got - should fail', function (done) {
    this.timeout(10000)

    let ping = new Monitor({
      protocol: 'web',
      protocolOptions: {
        engine: 'got',
        url:'https://testing.com/must-fail',
        httpOptions: {}
      },
      interval: 500
    })

    ping.on('up', (monitor: Monitor, response: MonitorResponse) => {
      ping.stop()
      done(new Error('Should have never got here'))
    })

    ping.on('down', (monitor: Monitor, response: MonitorResponse) => {
      const res = response.data
      const isTicking = monitor.isTicking
      
      expect(isTicking).to.equal(true)
      expect(res.statusCode).to.equal(500)
      // check state props
      expect((ping.protocolOptions as WebProtocolOptions).url).to.be.equal('https://testing.com/must-fail')
      expect(ping.interval).to.equal(500)

      ping.stop()
      done()
    })
  })

  it('web/puppeteer - should pass', function (done) {
    this.timeout(30000)

    let ping = new Monitor({
      protocol: 'web',
      protocolOptions: {
        engine: 'puppeteer',
        url: 'https://duckduckgo.com',
        httpOptions: {}
      },
      interval: 500
    }, true)

    ping.on('up', (monitor: Monitor, response: MonitorResponse) => {
      const res = response.data as puppeteer.Response
      const isTicking = monitor.isTicking

      expect(isTicking).to.equal(true)
      expect(res.status()).to.oneOf([200, 304])
      // check state props
      expect((ping.protocolOptions as WebProtocolOptions).url).to.be.equal('https://duckduckgo.com')
      expect(monitor.interval).to.equal(500)
      ping.stop()
      done()
    })

    ping.on('down', (monitor: Monitor, response: MonitorResponse) => {
      ping.stop()
      done(new Error('Should have never got here'))
    })

    ping.on('timeout', (monitor: Monitor, response: MonitorResponse) => {
      ping.stop()
      done(new Error('Should have never got here'))
    })

    ping.on('error', (monitor: Monitor, response: MonitorResponse) => {
      ping.stop()
      done(new Error('Should have never got here'))
    })
  })

  it('web/puppeteer - should timeout', function (done) {
    this.timeout(30000)

    let ping = new Monitor({
      protocol: 'web',
      protocolOptions: {
        engine: 'puppeteer',
        url: 'https://duckduckgo.com',
        httpOptions: {
          timeout: 1
        }
      },
      interval: 500
    }, true)

    ping.on('up', (monitor: Monitor, response: MonitorResponse) => {
      ping.stop()
      done(new Error('Should have never got here'))
    })

    ping.on('timeout', (monitor: Monitor, response: MonitorResponse) => {
      const isTicking = monitor.isTicking

      expect(isTicking).to.equal(true)
      ping.stop()
      done()
    })

    ping.on('down', (monitor: Monitor, response: MonitorResponse) => {
      ping.stop()
      done(new Error('Should have never got here'))
    })

    ping.on('error', (monitor: Monitor, response: MonitorResponse) => {
      ping.stop()
      done(new Error('Should have never got here'))
    })
  })

  it('web/got - should handle the stop event', function (done) {
    this.timeout(10000)
    
    let ping = new Monitor({
      protocol: 'web',
      protocolOptions: {
        engine: 'got',
        url:'https://testing.com/must-pass',
        httpOptions: {}
      },
      interval: 500
    })

    ping.on('stop', () => {
      done()
    })

    setTimeout(() => {
      ping.stop()
    }, 1000)
  });

  it('web/got - should connect to tcp', function (done) {
    this.timeout(10000)

    let ping = new Monitor({
      protocol: 'tcp',
      protocolOptions: {
        host: '127.0.0.1',
        port: 8124
      },
      interval: 500
    })

    ping.on('up', function (monitor: Monitor, response: MonitorResponse) {
      const res = response.data
      const isTicking = monitor.isTicking

      expect(isTicking).to.equal(true)
      ping.stop()
      done()
    })

    ping.on('error', function (monitor: Monitor, response: MonitorResponse) {
      ping.stop()
      done(new Error('Should have never got here'))
    })

    ping.on('timeout', function (monitor: Monitor, response: MonitorResponse) {
      ping.stop()
      done(new Error('Should have never got here'))
    })
  })


  it('web/got - should test redirect', function (done) {
    this.timeout(10000)

    try {
      let ping = new Monitor({
        protocol: 'web',
        protocolOptions: {
          engine: 'got',
          url:'https://testing.com/test-redirect',
          httpOptions: {}
        },
        interval: 500
      })

      ping.on('up', function (monitor: Monitor, response: MonitorResponse) {
        const res = response.data
        const isTicking = monitor.isTicking

        expect(isTicking).to.equal(true)

        expect(res.statusCode).to.equal(200)
        expect(res.requestUrl).to.equal('https://testing.com/test-redirect')
        expect(res.url).to.equal('https://testing.com/must-pass')
        expect(res.redirectUrls.length).to.equal(1)
        ping.stop()
        done()
      })

      ping.on('down', function (monitor: Monitor, response: MonitorResponse) {
        ping.stop()
        done(new Error('Should have never got here'))
      })
    }
    catch(e) {
      done(e)
    }
  })


  it('web/got - should post body', function (done) { 
    this.timeout(10000)

    let ping = new Monitor({
      protocol: 'web',
      protocolOptions: {
        url:'https://testing.com',
        engine: 'got',
        httpOptions: {
          path: '/users',
          method: 'post',
          body: 'Test'
        },
        expect: {
          statusCode: 200
        }
      },
      interval: 500,
    })

    ping.on('up', function (monitor: Monitor, response: MonitorResponse) {
      const res = response.data
      const isTicking = monitor.isTicking

      expect(isTicking).to.equal(true)
      expect(res.statusCode).to.equal(200)
      ping.stop()
      done()
    });

    ping.on('down', function (monitor: Monitor, response: MonitorResponse) {
      ping.stop()
      done(new Error('Should have never got here'))
    });

    ping.on('error', function (monitor: Monitor, response: MonitorResponse) {
      ping.stop()
      done(new Error('Should have never got here'))
    });
  })

  it('web/got - should timeout request', function (done) {
    this.timeout(10000)

    try {

      let ping = new Monitor({
        protocol: 'web',
        protocolOptions: {
          url:'https://testing.com/timeout',
          engine: 'got',
          httpOptions: {
            timeout: 100
          },
          expect: {
            statusCode: 200
          }
        },
        interval: 500,
      })

      ping.on('up', function (monitor: Monitor, response: MonitorResponse) {
        ping.stop()
        done(new Error('Should have never got here'))
      });

      ping.on('down', function (monitor: Monitor, response: MonitorResponse) {
        ping.stop()
        done(new Error('Should have never got here'))
      });

      ping.on('timeout', function (monitor: Monitor, response: MonitorResponse) {
        monitor.stop()
        done()
      });

      ping.on('error', function (monitor: Monitor, response: MonitorResponse) {
        ping.stop()
        done(new Error('Should have never got here'))
      });
    }
    catch(e) {
      done(e)
    }
  });

  it('web/got - should pass content search', function (done) {
    this.timeout(10000)

    let ping = new Monitor({
      protocol: 'web',
      protocolOptions: {
        engine: 'got',
        url:'https://testing.com/content-search',
        httpOptions: { },
        expect: {
          statusCode: 200,
          contentSearch: 'fox'
        }
      },
      interval: 500,
    })

    ping.on('up', function (monitor: Monitor, response: MonitorResponse) {
      
      const res = response.data
      const isTicking = monitor.isTicking

      expect(isTicking).to.equal(true)

      // check state props
      expect(monitor.interval).to.equal(500)
      expect(res.statusCode).to.equal(200)

      ping.stop()
      done()
    })

    ping.on('down', function (monitor: Monitor, response: MonitorResponse) {
      ping.stop()
      done(new Error('Should have never got here'))
    })
  })

  it('web/got - should fail content search', function (done) {
    this.timeout(10000)

    let ping = new Monitor({
      protocol: 'web',
      protocolOptions: {
        engine: 'got',
        url:'https://testing.com/content-search',
        httpOptions: { },
        expect: {
          statusCode: 200,
          contentSearch: '123'
        }
      },
      interval: 500,
    })

    ping.on('up', function (monitor: Monitor, response: MonitorResponse) {
      ping.stop()
      done(new Error('Should have never got here'))
    });

    ping.on('down', function (monitor: Monitor, response: MonitorResponse) {
      const res = response.data
      const isTicking = monitor.isTicking

      expect(isTicking).to.equal(true)
      expect(res.statusCode).to.equal(200)
      ping.stop()
      done()
    })
  })

  after(function (done) {
    tcpServer.close()
    done()
    process.exit()
  })
})
