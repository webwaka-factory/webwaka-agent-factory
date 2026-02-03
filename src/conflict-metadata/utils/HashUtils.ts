/**
 * TXQ-003 — Hash Utilities
 * 
 * SHA-256 hashing for conflict detection.
 * 
 * @module HashUtils
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

export class HashUtils {
  /**
   * Compute SHA-256 hash of content
   */
  async sha256(content: string): Promise<string> {
    // Web Crypto API (browser)
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Node.js crypto
    if (typeof require !== 'undefined') {
      try {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(content).digest('hex');
      } catch (error) {
        throw new Error('SHA-256 not available in this environment');
      }
    }
    
    throw new Error('No SHA-256 implementation available');
  }
  
  /**
   * Verify hash matches content
   */
  async verifyHash(content: string, expectedHash: string): Promise<boolean> {
    const actualHash = await this.sha256(content);
    return actualHash === expectedHash;
  }
}
