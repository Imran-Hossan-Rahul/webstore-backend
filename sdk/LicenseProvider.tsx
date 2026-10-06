import React from 'react';
import { LicenseManager } from './LicenseManager';

/**
 * ---------------------------------------------------------
 * CODALINA DRM - NEXT.JS WRAPPER
 * ---------------------------------------------------------
 * This file should be bundled and obfuscated along with LicenseManager.ts.
 * It strictly enforces the footer credit required by all plans.
 */

const license = new LicenseManager(
  process.env.LICENSE_KEY || '',
  process.env.DOMAIN_NAME || '',
  'global-install',
  {
    get: async () => null, // Provide actual DB/Cache implementation here
    set: async () => {} 
  }
);

export async function withCodalinaLicense(WrappedComponent: React.ComponentType<any>) {
  // 1. Enforce Server-Side License Verification
  const { valid } = await license.verifyLicense();
  
  if (!valid) {
    return function InvalidLicense() {
      return (
        <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2>Invalid or Suspended License</h2>
          <p>Please contact Codalina support or update your license key in the environment variables.</p>
        </div>
      );
    }
  }

  // 2. Enforce Footer Credit Injection
  return function ProtectedLayout(props: any) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ flex: 1 }}>
          <WrappedComponent {...props} />
        </div>
        
        {/* MANDATORY FOOTER CREDIT - DO NOT REMOVE */}
        <footer style={{ 
          padding: '12px', 
          textAlign: 'center', 
          backgroundColor: '#f8f9fa', 
          borderTop: '1px solid #eaeaea',
          fontSize: '14px',
          color: '#666'
        }}>
          Powered by <a href="https://codalina.com" target="_blank" style={{ color: '#0b2545', fontWeight: 'bold', textDecoration: 'none' }}>Codalina</a>
        </footer>
      </div>
    );
  }
}
