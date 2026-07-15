import Link from 'next/link'
import { CONTACT, BRANCH } from '@/lib/marketing-data'

export const metadata = { title: 'Privacy Policy — Maid For You Cleaning Services' }

const LAST_UPDATED = 'July 14, 2026'

export default function PrivacyPolicyPage() {
  return (
    <div>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
        <p className="text-gray-500">Last updated: {LAST_UPDATED}</p>
      </section>

      {/* Body */}
      <section className="pb-16 sm:pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-10">

          <div>
            <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
              Maid For You Cleaning Services (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) respects your privacy.
              This policy explains what information we collect when you use our website and booking platform,
              how we use it, and the choices you have.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Information We Collect</h2>
            <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
              When you create an account or book a service, we collect the information you provide directly,
              such as your full name, email address, and phone number. When you book a cleaning, we also
              collect your service address, property details (type and size), and your preferred schedule.
              If you contact support or file a complaint, we keep a record of those messages so our team can
              help you. We do not collect or store your payment card or e-wallet credentials — those are
              handled entirely by our payment processor (see Section&nbsp;3).
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. How We Use Your Information</h2>
            <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
              We use your information to process and manage your bookings, assign and dispatch cleaners,
              process payments, respond to support requests and complaints, and send you booking or
              account-related notifications. We do not use your information for advertising or marketing
              without your consent.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Who We Share It With</h2>
            <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
              We share only what&rsquo;s necessary to deliver our service:
            </p>
            <ul className="list-disc list-inside text-gray-600 leading-relaxed text-sm sm:text-base mt-2 space-y-1">
              <li>The cleaner assigned to your booking receives your service address and booking details.</li>
              <li>PayMongo, our payment processor, handles your payment directly — we never see or store your card or e-wallet credentials.</li>
              <li>Supabase, our database and authentication provider, stores your account and booking data securely on our behalf.</li>
            </ul>
            <p className="text-gray-600 leading-relaxed text-sm sm:text-base mt-2">
              We do not sell your personal information to third parties.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Cookies</h2>
            <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
              We use a session cookie to keep you signed in to your account. We do not use third-party
              advertising or tracking cookies on this site.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Data Retention &amp; Security</h2>
            <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
              We retain your information for as long as your account is active or as needed to provide our
              services and meet legal and accounting obligations. We apply reasonable technical and
              organizational safeguards to protect your data against unauthorized access, loss, or misuse.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Your Rights</h2>
            <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
              You may request access to, correction of, or deletion of your personal information at any
              time by contacting us using the details below.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Children&rsquo;s Privacy</h2>
            <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
              Our services are not directed at, and we do not knowingly collect personal information from,
              children under 18 years of age.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Changes to This Policy</h2>
            <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
              We may update this policy from time to time. Material changes will be reflected on this page
              with an updated &ldquo;Last updated&rdquo; date above.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Contact Us</h2>
            <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
              If you have any questions about this Privacy Policy or how we handle your data, please reach
              out:
            </p>
            <div className="mt-3 space-y-1 text-sm sm:text-base">
              <p className="text-gray-700">
                <a href={`mailto:${CONTACT.email}`} className="text-pink-600 hover:text-pink-700 transition-colors">
                  {CONTACT.email}
                </a>
              </p>
              <p className="text-gray-700">
                <a href={CONTACT.phoneTel} className="text-pink-600 hover:text-pink-700 transition-colors">
                  {CONTACT.phone}
                </a>
              </p>
              <p className="text-gray-500">{BRANCH.address}</p>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <Link href="/" className="text-sm text-pink-600 hover:text-pink-700 transition-colors">
              ← Back to home
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
