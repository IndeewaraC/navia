/**
 * Centralized Test Data Configuration
 * 
 * Update data here so you only have one place to change values
 * without needing to modify multiple .feature or .steps.ts files.
 */

export const testData = {
  auth: {
    validNewUserEmail: 'chandrabanugunathilaka@gmail.com',
    existingUserEmail: 'indeewaragunathilaka@gmail.com',
    validOtp: '123456',
    invalidOtp: '000000',
    invalidOtpErrorMessage: 'Invalid or expired OTP',
    invalidLoginOtpErrorMessage: 'Invalid OTP code'
  },
  settings: {
    validDisplayNames: {
      charsOnly: 'JohnDoe',
      numbersOnly: '123456789',
      symbolsOnly: '!@#$%^&*',
      mixedCharsNumbers: 'John123',
      allMixed: 'John_Doe-123!',
      maxLength: 'a'.repeat(50)
    },
    invalidDisplayNames: {
      tooLong: 'a'.repeat(51)
    },
    anchorDates: {
      pastDate: '2023-01-01',
      todayDate: new Date().toISOString().split('T')[0],
      futureDate: '2030-12-31'
    }
  },
  paymentMethods: {
    default: {
      name: 'Amex Platinum',
      limit: '5000'
    }
  },
  security: {
    payloads: {
      xss: [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert("XSS")>'
      ],
      sqli: [
        "' OR 1=1 --",
        '"; DROP TABLE users; --'
      ]
    }
  },
  groceries: {
    item1: { name: 'Organic Milk', price: '$4.50' },
    item2: { name: 'Whole Wheat Bread', price: '$3.20' },
    runningTotal: '$7.70',
    checkoutTotal: '$8.00',
    pastTrip: {
      store: "Trader Joe's",
      total: "$45.00"
    }
  },
  vault: {
    accountBalance: '$10,000.00',
    newProject: {
      name: 'Car Repair',
      target: '$2000.00'
    },
    fundAmount: '$500.00',
    editProject: {
      name: 'Vacation',
      oldTarget: '$3000.00',
      newTarget: '$4000.00'
    }
  },
  history: {
    searchCategory: 'Dining',
    searchAmount: '14.99'
  }
};
