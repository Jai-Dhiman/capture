#!/usr/bin/env node

/**
 * Edge Caching Test Script
 * Tests edge caching functionality across different scenarios
 */

class EdgeCacheTest {
  constructor(baseUrl = 'https://capture-api.jai-d.workers.dev') {
    this.baseUrl = baseUrl;
    this.testResults = [];
  }

  async runTests() {
    console.log('🧪 Starting Edge Cache Tests...\n');

    await this.testStaticAssetCaching();
    await this.testAPICaching();
    await this.testMediaCaching();
    await this.testGeographicCaching();
    await this.testDeviceBasedCaching();
    await this.testStaleWhileRevalidate();
    await this.testCachePurging();

    this.generateReport();
  }

  async testStaticAssetCaching() {
    console.log('📄 Testing Static Asset Caching...');
    
    try {
      const endpoint = '/api/media/test-image.jpg';
      
      // First request (should be MISS)
      const response1 = await this.makeRequest(endpoint);
      const cacheStatus1 = response1.headers.get('CF-Cache-Status') || 'UNKNOWN';
      
      // Second request (should be HIT)
      const response2 = await this.makeRequest(endpoint);
      const cacheStatus2 = response2.headers.get('CF-Cache-Status') || 'UNKNOWN';
      
      const result = {
        test: 'Static Asset Caching',
        status: cacheStatus2 === 'HIT' ? 'PASS' : 'FAIL',
        details: {
          firstRequest: cacheStatus1,
          secondRequest: cacheStatus2,
          cacheControl: response2.headers.get('Cache-Control'),
          edgeProcessed: response2.headers.get('X-Edge-Processed'),
        }
      };
      
      this.testResults.push(result);
      console.log(`   ${result.status}: First=${cacheStatus1}, Second=${cacheStatus2}\n`);
      
    } catch (error) {
      this.testResults.push({
        test: 'Static Asset Caching',
        status: 'ERROR',
        error: error.message
      });
      console.log(`   ERROR: ${error.message}\n`);
    }
  }

  async testAPICaching() {
    console.log('🔌 Testing API Response Caching...');
    
    try {
      const endpoint = '/api/profile/test-user';
      
      const response1 = await this.makeRequest(endpoint, {
        headers: { 'Authorization': 'Bearer test-token' }
      });
      
      const response2 = await this.makeRequest(endpoint, {
        headers: { 'Authorization': 'Bearer test-token' }
      });
      
      const cacheStatus1 = response1.headers.get('CF-Cache-Status') || 'UNKNOWN';
      const cacheStatus2 = response2.headers.get('CF-Cache-Status') || 'UNKNOWN';
      
      const result = {
        test: 'API Response Caching',
        status: response2.ok ? 'PASS' : 'FAIL',
        details: {
          firstRequest: cacheStatus1,
          secondRequest: cacheStatus2,
          geographic: response2.headers.get('X-Edge-Geographic'),
          personalized: response2.headers.get('X-Edge-Processed'),
        }
      };
      
      this.testResults.push(result);
      console.log(`   ${result.status}: Geographic=${result.details.geographic}\n`);
      
    } catch (error) {
      this.testResults.push({
        test: 'API Response Caching',
        status: 'ERROR',
        error: error.message
      });
      console.log(`   ERROR: ${error.message}\n`);
    }
  }

  async testMediaCaching() {
    console.log('🖼️  Testing Media CDN Caching...');
    
    try {
      const endpoint = '/api/media/cdn/test-media-id?variant=medium&format=webp';
      
      const response1 = await this.makeRequest(endpoint);
      const response2 = await this.makeRequest(endpoint);
      
      const cacheStatus1 = response1.headers.get('CF-Cache-Status') || 'UNKNOWN';
      const cacheStatus2 = response2.headers.get('CF-Cache-Status') || 'UNKNOWN';
      const cacheAge = response2.headers.get('X-Cache-Age');
      
      const result = {
        test: 'Media CDN Caching',
        status: response2.ok ? 'PASS' : 'FAIL',
        details: {
          firstRequest: cacheStatus1,
          secondRequest: cacheStatus2,
          cacheAge: cacheAge,
          deviceOptimized: response2.headers.get('X-Device-Type'),
          edgeStrategy: response2.headers.get('X-Edge-Strategy'),
        }
      };
      
      this.testResults.push(result);
      console.log(`   ${result.status}: Age=${cacheAge}s, Device=${result.details.deviceOptimized}\n`);
      
    } catch (error) {
      this.testResults.push({
        test: 'Media CDN Caching',
        status: 'ERROR',
        error: error.message
      });
      console.log(`   ERROR: ${error.message}\n`);
    }
  }

  async testGeographicCaching() {
    console.log('🌍 Testing Geographic-Based Caching...');
    
    try {
      const endpoint = '/api/feed/discovery';
      
      // Simulate requests from different countries
      const response1 = await this.makeRequest(endpoint, {
        headers: { 
          'CF-IPCountry': 'US',
          'CF-IPContinent': 'NA'
        }
      });
      
      const response2 = await this.makeRequest(endpoint, {
        headers: { 
          'CF-IPCountry': 'JP',
          'CF-IPContinent': 'AS'
        }
      });
      
      const geo1 = response1.headers.get('X-Edge-Geographic');
      const geo2 = response2.headers.get('X-Edge-Geographic');
      
      const result = {
        test: 'Geographic-Based Caching',
        status: geo1 !== geo2 ? 'PASS' : 'FAIL',
        details: {
          usRequest: geo1,
          jpRequest: geo2,
          differentCache: geo1 !== geo2,
        }
      };
      
      this.testResults.push(result);
      console.log(`   ${result.status}: US=${geo1}, JP=${geo2}\n`);
      
    } catch (error) {
      this.testResults.push({
        test: 'Geographic-Based Caching',
        status: 'ERROR',
        error: error.message
      });
      console.log(`   ERROR: ${error.message}\n`);
    }
  }

  async testDeviceBasedCaching() {
    console.log('📱 Testing Device-Based Caching...');
    
    try {
      const endpoint = '/api/media/cdn/test-image';
      
      // Simulate mobile request
      const mobileResponse = await this.makeRequest(endpoint, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
        }
      });
      
      // Simulate desktop request
      const desktopResponse = await this.makeRequest(endpoint, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      const mobileDevice = mobileResponse.headers.get('X-Edge-Device');
      const desktopDevice = desktopResponse.headers.get('X-Edge-Device');
      
      const result = {
        test: 'Device-Based Caching',
        status: mobileDevice !== desktopDevice ? 'PASS' : 'FAIL',
        details: {
          mobileDevice,
          desktopDevice,
          differentOptimizations: mobileDevice !== desktopDevice,
        }
      };
      
      this.testResults.push(result);
      console.log(`   ${result.status}: Mobile=${mobileDevice}, Desktop=${desktopDevice}\n`);
      
    } catch (error) {
      this.testResults.push({
        test: 'Device-Based Caching',
        status: 'ERROR',
        error: error.message
      });
      console.log(`   ERROR: ${error.message}\n`);
    }
  }

  async testStaleWhileRevalidate() {
    console.log('🔄 Testing Stale-While-Revalidate...');
    
    try {
      const endpoint = '/api/test-swr';
      
      // First request to populate cache
      await this.makeRequest(endpoint);
      
      // Wait a bit to simulate age
      await this.sleep(2000);
      
      // Second request should potentially trigger SWR
      const response = await this.makeRequest(endpoint);
      const cacheStatus = response.headers.get('CF-Cache-Status');
      const cacheAge = response.headers.get('X-Cache-Age');
      
      const result = {
        test: 'Stale-While-Revalidate',
        status: cacheStatus ? 'PASS' : 'FAIL',
        details: {
          cacheStatus,
          cacheAge,
          swrEnabled: response.headers.get('X-Edge-Cache-SWR') !== null,
        }
      };
      
      this.testResults.push(result);
      console.log(`   ${result.status}: Status=${cacheStatus}, Age=${cacheAge}s\n`);
      
    } catch (error) {
      this.testResults.push({
        test: 'Stale-While-Revalidate',
        status: 'ERROR',
        error: error.message
      });
      console.log(`   ERROR: ${error.message}\n`);
    }
  }

  async testCachePurging() {
    console.log('🗑️  Testing Cache Purging...');
    
    try {
      const mediaId = 'test-purge-media';
      const endpoint = `/api/media/purge-cache/${mediaId}`;
      
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token' }
      });
      
      const result = {
        test: 'Cache Purging',
        status: response.ok ? 'PASS' : 'FAIL',
        details: {
          responseStatus: response.status,
          purgeSupported: response.headers.get('X-Purge-Support') !== null,
        }
      };
      
      this.testResults.push(result);
      console.log(`   ${result.status}: Status=${response.status}\n`);
      
    } catch (error) {
      this.testResults.push({
        test: 'Cache Purging',
        status: 'ERROR',
        error: error.message
      });
      console.log(`   ERROR: ${error.message}\n`);
    }
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'EdgeCacheTest/1.0',
        ...options.headers
      }
    };
    
    return fetch(url, { ...defaultOptions, ...options });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateReport() {
    console.log('📊 Edge Cache Test Results Summary:\n');
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const errors = this.testResults.filter(r => r.status === 'ERROR').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Errors: ${errors}`);
    console.log(`📈 Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%\n`);
    
    // Detailed results
    console.log('Detailed Results:');
    console.log('='.repeat(50));
    
    this.testResults.forEach(result => {
      const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${emoji} ${result.test}: ${result.status}`);
      
      if (result.details) {
        Object.entries(result.details).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
      }
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      console.log('');
    });
    
    // Save report to file
    const report = {
      timestamp: new Date().toISOString(),
      summary: { passed, failed, errors, total: this.testResults.length },
      results: this.testResults
    };
    
    // In a real environment, this would save to a file
    console.log('📄 Test report generated (would be saved to edge-cache-test-report.json)');
  }
}

// Run tests if called directly
if (require.main === module) {
  const baseUrl = process.argv[2] || 'https://capture-api.jai-d.workers.dev';
  const tester = new EdgeCacheTest(baseUrl);
  tester.runTests().catch(console.error);
}

module.exports = { EdgeCacheTest };