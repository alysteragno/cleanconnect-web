'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-sm px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors shrink-0 print:hidden"
    >
      Print / Export PDF
    </button>
  )
}
