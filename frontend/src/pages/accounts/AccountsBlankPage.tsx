'use client'

import { Construction } from 'lucide-react'

export default function AccountsBlankPage({
  title,
  description = 'This page is not built yet.',
}: {
  title: string
  description?: string
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2">
          {title}
        </h1>
        <p className="text-gray-600">{description}</p>
      </div>

      {/* Blank placeholder */}
      <div className="bg-white rounded-lg border border-[#EFECE5] shadow-sm p-12 flex flex-col items-center text-center max-w-xl mx-auto mt-8">
        <div className="w-16 h-16 bg-[#F2EFE8] rounded-2xl flex items-center justify-center mb-5">
          <Construction className="w-8 h-8 text-gray-500" />
        </div>
        <h2 className="text-xl font-serif font-bold text-gray-900 mb-2">
          Coming soon
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          The {title} screen will live here once it&apos;s built.
        </p>
      </div>
    </div>
  )
}