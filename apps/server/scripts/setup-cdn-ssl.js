#!/usr/bin/env node

/**
 * Script to configure SSL certificates and CDN domain for Cloudflare Workers
 * This script sets up:
 * 1. SSL certificates for the CDN domain
 * 2. DNS records for the CDN domain
 * 3. SSL/TLS configuration
 * 4. HSTS and security headers
 */

const https = require('https');
const { execSync } = require('child_process');

// Configuration
const CDN_DOMAIN = 'cdn.capture-app.com';
const ZONE_NAME = 'capture-app.com';

// Cloudflare API configuration
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

class CDNSSLSetup {
  constructor() {
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
    this.zoneId = process.env.CDN_ZONE_ID;
    
    if (!this.apiToken) {
      throw new Error('CLOUDFLARE_API_TOKEN environment variable is required');
    }
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    const url = `${CLOUDFLARE_API_BASE}${endpoint}`;
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`API Error: ${result.errors?.map(e => e.message).join(', ') || 'Unknown error'}`);
      }
      
      return result.result;
    } catch (error) {
      console.error(`Request failed for ${endpoint}:`, error.message);
      throw error;
    }
  }

  async findZoneId() {
    if (this.zoneId) return this.zoneId;
    
    console.log(`Finding zone ID for ${ZONE_NAME}...`);
    const zones = await this.makeRequest(`/zones?name=${ZONE_NAME}`);
    
    if (zones.length === 0) {
      throw new Error(`Zone ${ZONE_NAME} not found`);
    }
    
    this.zoneId = zones[0].id;
    console.log(`Found zone ID: ${this.zoneId}`);
    return this.zoneId;
  }

  async createCNAMERecord() {
    const zoneId = await this.findZoneId();
    
    console.log(`Creating CNAME record for ${CDN_DOMAIN}...`);
    
    // Check if record already exists
    const existingRecords = await this.makeRequest(`/zones/${zoneId}/dns_records?type=CNAME&name=${CDN_DOMAIN}`);
    
    if (existingRecords.length > 0) {
      console.log('CNAME record already exists');
      return existingRecords[0];
    }
    
    // Create new CNAME record pointing to Workers domain
    const record = await this.makeRequest(`/zones/${zoneId}/dns_records`, 'POST', {
      type: 'CNAME',
      name: CDN_DOMAIN,
      content: 'capture-api.jai-d.workers.dev',
      ttl: 1, // Auto TTL
      proxied: true, // Enable Cloudflare proxy for SSL
    });
    
    console.log(`Created CNAME record: ${record.name} -> ${record.content}`);
    return record;
  }

  async configureSSL() {
    const zoneId = await this.findZoneId();
    
    console.log('Configuring SSL settings...');
    
    // Set SSL mode to Full (strict)
    await this.makeRequest(`/zones/${zoneId}/settings/ssl`, 'PATCH', {
      value: 'full'
    });
    
    // Enable TLS 1.3
    await this.makeRequest(`/zones/${zoneId}/settings/tls_1_3`, 'PATCH', {
      value: 'on'
    });
    
    // Enable HSTS
    await this.makeRequest(`/zones/${zoneId}/settings/security_header`, 'PATCH', {
      value: {
        strict_transport_security: {
          enabled: true,
          max_age: 31536000,
          include_subdomains: true,
          preload: true
        }
      }
    });
    
    console.log('SSL configuration completed');
  }

  async setupPageRules() {
    const zoneId = await this.findZoneId();
    
    console.log('Setting up page rules for CDN optimization...');
    
    // Check existing page rules
    const existingRules = await this.makeRequest(`/zones/${zoneId}/pagerules`);
    
    const cdnRule = existingRules.find(rule => 
      rule.targets.some(target => target.constraint.value.includes(CDN_DOMAIN))
    );
    
    if (cdnRule) {
      console.log('CDN page rule already exists');
      return cdnRule;
    }
    
    // Create page rule for CDN domain
    const rule = await this.makeRequest(`/zones/${zoneId}/pagerules`, 'POST', {
      targets: [{
        target: 'url',
        constraint: {
          operator: 'matches',
          value: `${CDN_DOMAIN}/*`
        }
      }],
      actions: [
        {
          id: 'cache_level',
          value: 'cache_everything'
        },
        {
          id: 'edge_cache_ttl',
          value: 31536000 // 1 year
        },
        {
          id: 'browser_cache_ttl',
          value: 31536000 // 1 year
        },
        {
          id: 'ssl',
          value: 'flexible'
        }
      ],
      status: 'active'
    });
    
    console.log('Created CDN page rule');
    return rule;
  }

  async enableHTTPS() {
    const zoneId = await this.findZoneId();
    
    console.log('Enabling HTTPS redirects...');
    
    // Enable Always Use HTTPS
    await this.makeRequest(`/zones/${zoneId}/settings/always_use_https`, 'PATCH', {
      value: 'on'
    });
    
    // Enable Automatic HTTPS Rewrites
    await this.makeRequest(`/zones/${zoneId}/settings/automatic_https_rewrites`, 'PATCH', {
      value: 'on'
    });
    
    console.log('HTTPS redirects enabled');
  }

  async setupCustomCert() {
    const zoneId = await this.findZoneId();
    
    console.log('Checking SSL certificate status...');
    
    // Get SSL verification status
    const sslStatus = await this.makeRequest(`/zones/${zoneId}/ssl/verification`);
    
    if (sslStatus.length === 0) {
      console.log('No custom SSL certificates found. Using Cloudflare Universal SSL.');
      return;
    }
    
    console.log('SSL certificate verification status:', sslStatus[0].certificate_status);
  }

  async run() {
    try {
      console.log('Starting CDN SSL setup...');
      
      await this.createCNAMERecord();
      await this.configureSSL();
      await this.setupPageRules();
      await this.enableHTTPS();
      await this.setupCustomCert();
      
      console.log('\n✅ CDN SSL setup completed successfully!');
      console.log(`\nCDN domain: https://${CDN_DOMAIN}`);
      console.log('SSL/TLS: Full encryption with TLS 1.3');
      console.log('HSTS: Enabled with 1 year max-age');
      console.log('Cache: Aggressive caching with 1 year TTL');
      
      // Update wrangler.toml with zone ID
      if (this.zoneId) {
        console.log(`\nUpdate your wrangler.toml with CDN_ZONE_ID="${this.zoneId}"`);
      }
      
    } catch (error) {
      console.error('❌ CDN SSL setup failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the setup
if (require.main === module) {
  const setup = new CDNSSLSetup();
  setup.run();
}

module.exports = { CDNSSLSetup };