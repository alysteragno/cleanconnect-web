function BankTransferSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="8" fill="#374151" />
      <path d="M5 16L18 8L31 16H5Z" fill="white" fillOpacity="0.95" />
      <rect x="8" y="17" width="4" height="10" rx="1" fill="white" fillOpacity="0.95" />
      <rect x="16" y="17" width="4" height="10" rx="1" fill="white" fillOpacity="0.95" />
      <rect x="24" y="17" width="4" height="10" rx="1" fill="white" fillOpacity="0.95" />
      <rect x="4" y="27" width="28" height="3" rx="1" fill="white" fillOpacity="0.95" />
    </svg>
  )
}

function BankCheckSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="8" fill="#1e40af" />
      <rect x="4" y="10" width="28" height="18" rx="2" stroke="white" strokeWidth="1.8" fill="none" strokeOpacity="0.9" />
      <line x1="8" y1="16" x2="20" y2="16" stroke="white" strokeWidth="1.5" strokeOpacity="0.8" />
      <line x1="8" y1="20" x2="16" y2="20" stroke="white" strokeWidth="1.5" strokeOpacity="0.8" />
      <rect x="22" y="17" width="7" height="5" rx="1" fill="white" fillOpacity="0.3" stroke="white" strokeWidth="1" strokeOpacity="0.7" />
      <line x1="4" y1="13" x2="32" y2="13" stroke="white" strokeWidth="1" strokeOpacity="0.3" />
    </svg>
  )
}

function CashSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="8" fill="#059669" />
      <rect x="5" y="12" width="26" height="16" rx="2" stroke="white" strokeWidth="2" fill="none" strokeOpacity="0.9" />
      <circle cx="18" cy="20" r="4" stroke="white" strokeWidth="2" fill="none" strokeOpacity="0.9" />
      <line x1="5" y1="16" x2="10" y2="16" stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />
      <line x1="26" y1="16" x2="31" y2="16" stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />
      <line x1="5" y1="24" x2="10" y2="24" stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />
      <line x1="26" y1="24" x2="31" y2="24" stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />
    </svg>
  )
}

export const PAYMENT_METHOD_META: Record<string, { label: string; isDigital: boolean; hasLogo: boolean }> = {
  gcash:         { label: 'GCash',         isDigital: true,  hasLogo: true  },
  maya:          { label: 'Maya',          isDigital: true,  hasLogo: true  },
  bank_transfer: { label: 'Bank Transfer', isDigital: true,  hasLogo: false },
  bank_check:    { label: 'Bank Check',    isDigital: false, hasLogo: false },
  cash:          { label: 'Cash',          isDigital: false, hasLogo: false },
}

export function PaymentMethodIcon({ method, size = 32 }: { method: string; size?: number }) {
  if (method === 'gcash') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/GCash_logo.svg" alt="GCash" width={size} height={size} className="object-contain" />
  }
  if (method === 'maya') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/maya_logo.jpeg" alt="Maya" width={size} height={size} className="object-contain rounded-lg" />
  }
  if (method === 'bank_transfer') {
    return <BankTransferSVG size={size} />
  }
  if (method === 'bank_check') {
    return <BankCheckSVG size={size} />
  }
  return <CashSVG size={size} />
}
