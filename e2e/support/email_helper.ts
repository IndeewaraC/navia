import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

/**
 * Connects to the test email inbox via IMAP and waits for the newest email 
 * containing the OTP.
 */
export async function fetchLatestOtp(emailAddress: string, maxWaitMs = 15000): Promise<string | null> {
  // Use environment variables for secure IMAP credentials
  const config = {
    imap: {
      user: process.env.IMAP_USER || emailAddress,
      password: process.env.IMAP_PASSWORD || 'your_app_password_here',
      host: process.env.IMAP_HOST || 'imap.gmail.com',
      port: 993,
      tls: true,
      authTimeout: 3000,
      tlsOptions: { rejectUnauthorized: false } // Only for testing
    }
  };

  const startTime = Date.now();

  // Retry loop in case the email is delayed
  while (Date.now() - startTime < maxWaitMs) {
    let connection;
    try {
      connection = await imaps.connect(config);
      await connection.openBox('INBOX');

      // Fetch emails from the last 5 minutes sent to this address
      const searchCriteria = [
        'UNSEEN',
        ['SINCE', new Date(Date.now() - 5 * 60 * 1000).toISOString()]
      ];
      
      const fetchOptions = {
        bodies: ['HEADER', 'TEXT', ''],
        markSeen: true
      };

      const messages = await connection.search(searchCriteria, fetchOptions);

      if (messages.length > 0) {
        // Get the latest message
        const latestMessage = messages[messages.length - 1];
        const allParts = latestMessage.parts.find(part => part.which === '');
        
        if (allParts && allParts.body) {
          const parsed = await simpleParser(allParts.body);
          
          // Regex to extract a 6-digit OTP (modify based on actual email template)
          const otpRegex = /\b\d{6}\b/; 
          const textContent = typeof parsed.text === 'string' ? parsed.text : '';
          const htmlContent = typeof parsed.html === 'string' ? parsed.html : '';
          const match = textContent.match(otpRegex) || htmlContent.match(otpRegex);
          
          if (match) {
            connection.end();
            return match[0];
          }
        }
      }
      
      connection.end();
    } catch (error) {
      console.warn("IMAP Connection error, retrying...", error);
      if (connection) connection.end();
    }

    // Wait 2 seconds before polling again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error(`Timeout: Failed to fetch OTP for ${emailAddress} after ${maxWaitMs}ms`);
}
