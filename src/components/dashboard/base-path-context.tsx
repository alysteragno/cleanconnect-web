'use client'

import { createContext, useContext } from 'react'

const BasePathContext = createContext('/admin')

export function BasePathProvider({
  basePath,
  children,
}: {
  basePath: string
  children: React.ReactNode
}) {
  return <BasePathContext.Provider value={basePath}>{children}</BasePathContext.Provider>
}

/** '' on the admin subdomain, '/admin' everywhere else — see src/utils/base-path.ts. */
export function useBasePath(): string {
  return useContext(BasePathContext)
}
