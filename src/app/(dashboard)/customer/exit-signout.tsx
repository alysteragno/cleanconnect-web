'use client'

import { useEffect } from 'react'

// Signs the customer out the moment they leave this page, by any means —
// navigating away, closing the tab, or refreshing. pagehide is the one event
// that reliably fires for all of those (unlike beforeunload/unload, it also
// covers bfcache navigations), and sendBeacon fires the request without
// blocking or risking cancellation during unload.
export default function ExitSignout() {
  useEffect(() => {
    function signOutOnExit() {
      navigator.sendBeacon('/api/customer-exit-signout')
    }
    window.addEventListener('pagehide', signOutOnExit)
    return () => window.removeEventListener('pagehide', signOutOnExit)
  }, [])

  return null
}
