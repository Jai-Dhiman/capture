#!/usr/bin/env node

/**
 * SSL Certificate Monitoring Script
 * Monitors SSL certificate status and expiration for CDN domains
 */

const https = require('https');
const tls = require('tls');

class SSLMonitor {
  constructor() {
    this.domains = [
      'cdn.capture-app.com',
      'capture-api.jai-d.workers.dev',
      'capture-app.com'
    ];
  }

  async checkCertificate(domain) {
    return new Promise((resolve, reject) => {
      const options = {
        host: domain,
        port: 443,
        method: 'GET',
        path: '/',
        timeout: 10000,
        checkServerIdentity: () => undefined, // Disable hostname verification for this check
      };

      const req = https.request(options, (res) => {
        const cert = res.socket.getPeerCertificate();
        
        if (!cert || Object.keys(cert).length === 0) {
          reject(new Error(`No certificate found for ${domain}`));
          return;
        }

        const now = new Date();
        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        const daysUntilExpiry = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));

        resolve({
          domain,
          subject: cert.subject,
          issuer: cert.issuer,
          validFrom,
          validTo,
          daysUntilExpiry,
          fingerprint: cert.fingerprint,
          serialNumber: cert.serialNumber,
          protocol: res.socket.getProtocol(),
          cipher: res.socket.getCipher(),
          authorized: res.socket.authorized,
          authorizationError: res.socket.authorizationError,
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error(`Timeout connecting to ${domain}`)));
      req.setTimeout(10000);
      req.end();
    });
  }

  async checkAllCertificates() {
    const results = [];
    
    for (const domain of this.domains) {
      try {
        console.log(`Checking certificate for ${domain}...`);
        const result = await this.checkCertificate(domain);
        results.push(result);
        
        // Log certificate info
        console.log(`✅ ${domain}:`);
        console.log(`   Issuer: ${result.issuer.CN}`);
        console.log(`   Valid until: ${result.validTo.toDateString()}`);
        console.log(`   Days until expiry: ${result.daysUntilExpiry}`);
        console.log(`   Protocol: ${result.protocol}`);
        console.log(`   Cipher: ${result.cipher?.name || 'Unknown'}`);
        console.log(`   Authorized: ${result.authorized}`);
        
        // Warn if certificate expires soon
        if (result.daysUntilExpiry < 30) {
          console.log(`   ⚠️  Certificate expires in ${result.daysUntilExpiry} days!`);
        }
        
        console.log('');
        
      } catch (error) {
        console.error(`❌ ${domain}: ${error.message}`);
        results.push({
          domain,
          error: error.message,
          status: 'error'
        });
      }
    }
    
    return results;
  }

  async checkCloudflareSSLStatus() {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const zoneId = process.env.CDN_ZONE_ID;
    
    if (!apiToken || !zoneId) {
      console.log('Skipping Cloudflare SSL status check (missing API token or zone ID)');
      return null;
    }
    
    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/ssl/verification`, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('Cloudflare SSL Status:');
        data.result.forEach(cert => {
          console.log(`  Certificate: ${cert.certificate_authority}`);
          console.log(`  Status: ${cert.certificate_status}`);
          console.log(`  Expires: ${new Date(cert.expires_on).toDateString()}`);
          console.log('');
        });
        return data.result;
      } else {
        console.error('Failed to fetch Cloudflare SSL status:', data.errors);
        return null;
      }
    } catch (error) {
      console.error('Error checking Cloudflare SSL status:', error.message);
      return null;
    }
  }

  generateReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        valid: results.filter(r => !r.error).length,
        errors: results.filter(r => r.error).length,
        expiringSoon: results.filter(r => r.daysUntilExpiry && r.daysUntilExpiry < 30).length,
      },
      certificates: results,
    };
    
    console.log('\n📊 SSL Certificate Summary:');
    console.log(`Total domains checked: ${report.summary.total}`);
    console.log(`Valid certificates: ${report.summary.valid}`);
    console.log(`Errors: ${report.summary.errors}`);
    console.log(`Expiring soon (< 30 days): ${report.summary.expiringSoon}`);
    
    if (report.summary.expiringSoon > 0) {
      console.log('\n⚠️  Action Required: Some certificates are expiring soon!');
    }
    
    return report;
  }

  async run() {
    try {
      console.log('🔍 Starting SSL certificate monitoring...\n');
      
      const results = await this.checkAllCertificates();
      await this.checkCloudflareSSLStatus();
      
      const report = this.generateReport(results);
      
      // Write report to file
      const fs = require('fs');
      const reportPath = './ssl-monitor-report.json';
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Report saved to: ${reportPath}`);
      
      // Exit with non-zero code if there are issues
      if (report.summary.errors > 0 || report.summary.expiringSoon > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ SSL monitoring failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the monitor
if (require.main === module) {
  const monitor = new SSLMonitor();
  monitor.run();
}

module.exports = { SSLMonitor };