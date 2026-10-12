/**
 * Global Data Store for E2E Tests
 * 
 * Used to store and share state between steps in Cucumber scenarios,
 * preventing hardcoded values and promoting data reuse.
 */

export class GlobalTestData {
  private static instance: GlobalTestData;
  
  // Shared state variables
  public userEmail: string = '';
  public otpCode: string = '';
  public currentPaymentMethod: {
    alias: string;
    limit: number;
  } | null = null;
  public testSessionToken: string = '';

  private constructor() {
    // Private constructor for Singleton pattern
  }

  /**
   * Get the singleton instance of the GlobalTestData
   */
  public static getInstance(): GlobalTestData {
    if (!GlobalTestData.instance) {
      GlobalTestData.instance = new GlobalTestData();
    }
    return GlobalTestData.instance;
  }

  /**
   * Clears all stored data (ideal for an After() hook)
   */
  public resetData(): void {
    this.userEmail = '';
    this.otpCode = '';
    this.currentPaymentMethod = null;
    this.testSessionToken = '';
  }

  // Common Test Constants
  public readonly validEmails = {
    standard: 'qa+standard@navia.test',
    admin: 'qa+admin@navia.test'
  };

  public readonly securityPayloads = {
    xss: "<script>alert('XSS')</script>",
    sqli: "' OR 1=1 --"
  };
}

export const globalData = GlobalTestData.getInstance();
