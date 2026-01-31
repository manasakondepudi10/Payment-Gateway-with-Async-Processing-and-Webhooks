function isValidVPA(vpa) {
  if (!vpa) return false;
  const pattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
  return pattern.test(vpa);
}

function luhnCheck(input) {
  if (!input) return false;
  const digits = input.replace(/[^0-9]/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = parseInt(digits[i], 10);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function detectCardNetwork(input) {
  const digits = (input || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('4')) return 'visa';
  const firstTwo = digits.slice(0, 2);
  const firstThree = digits.slice(0, 3);
  if (['51', '52', '53', '54', '55'].includes(firstTwo)) return 'mastercard';
  if (firstTwo === '34' || firstTwo === '37') return 'amex';
  const asInt = parseInt(firstTwo, 10);
  if (digits.startsWith('60') || digits.startsWith('65') || (asInt >= 81 && asInt <= 89)) return 'rupay';
  return 'unknown';
}

function validateExpiry(monthStr, yearStr) {
  const month = parseInt(monthStr, 10);
  let year = parseInt(yearStr, 10);
  if (!month || month < 1 || month > 12 || !year) return false;
  if (year < 100) year = 2000 + year;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  return true;
}

module.exports = {
  isValidVPA,
  luhnCheck,
  detectCardNetwork,
  validateExpiry,
};
