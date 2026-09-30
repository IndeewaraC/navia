import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

/**
 * Connects to the configured Gmail account via IMAP and retrieves the most recent 
 * OTP (6 digits) sent to a specific alias.
 * 
 * @param targetEmailAlias - The specific test email alias the OTP was sent to (e.g. user+test1@gmail.com)
 * @param maxRetries - How many times to poll the inbox
 * @param retryDelayMs - Delay between polls
 */
export async function getOtpFromGmail(
  targetEmailAlias: string, 
  maxRetries = 5, 
  retryDelayMs = 3000
): Promise<string> {
  const config = {
    imap: {
      user: process.env.GMAIL_USER!,
      password: process.env.GMAIL_APP_PASSWORD!,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      authTimeout: 10000
    }
  };

  let connection;
  try {
    connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    const searchCriteria = ['UNSEEN', ['TO', targetEmailAlias]];
    const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: true };
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[IMAP] Polling for OTP email to ${targetEmailAlias} (Attempt ${attempt}/${maxRetries})...`);
      const messages = await connection.search(searchCriteria, fetchOptions);
      
      if (messages.length > 0) {
        // Get the latest message if multiple arrived
        const latestMessage = messages[messages.length - 1];
        const all = latestMessage.parts.find((part: any) => part.which === 'TEXT');
        
        if (all) {
          const parsed = await simpleParser(all.body);
          const bodyText = parsed.text || '';
          
          // Use regex to find a 6-digit number (common for OTPs)
          const match = bodyText.match(/\b\d{6}\b/);
          if (match) {
            console.log('[IMAP] OTP successfully extracted!');
            connection.end();
            return match[0];
          }
        }
      }
      
      // Wait before retrying
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, retryDelayMs));
      }
    }
    
    throw new Error(`OTP email not found for ${targetEmailAlias} after ${maxRetries} attempts.`);
  } catch (error) {
    console.error('[IMAP Error]', error);
    if (connection) connection.end();
    throw error;
  }
}
