import type { Metadata } from 'next'
import MobileAppPlaceholder from '@/components/mobile-placeholder'

export const metadata: Metadata = {
  title: 'Get the App — Maid For You Cleaning Services',
  description: 'Booking, scheduling, and tracking your cleaning services are available on the Maid For You mobile app.',
}

export default function DownloadPage() {
  return <MobileAppPlaceholder role="customer" showSignOut={false} />
}
