'use client'

import { Link } from 'react-router-dom'
import { Construction, ArrowLeft } from 'lucide-react'

export default function PlaceholderPage({
  module,
}: {
  module: string
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2">
          {module} module
        </h1>
        <p className="text-gray-600">
          This workspace is coming soon.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-[#EFECE5] shadow-sm p-12 flex flex-col items-center text-center max-w-xl mx-auto mt-8">
        <div className="w-16 h-16 bg-[#F2EFE8] rounded-2xl flex items-center justify-center mb-5">
          <Construction className="w-8 h-8 text-gray-500" />
        </div>
        <h2 className="text-xl font-serif font-bold text-gray-900 mb-2">
          Under construction
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-8">
          The {module} module hasn&apos;t been built yet. We&apos;ll add its tools here once ready.
        </p>
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to modules
        </Link>
      </div>
    </div>
  )
}