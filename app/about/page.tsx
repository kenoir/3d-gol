import Link from 'next/link'

export default function About() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
            About Game of Life
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            This is a Next.js application designed to be deployed to GitHub Pages.
            It demonstrates the use of Next.js with static export capabilities.
          </p>
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Features
            </h2>
            <ul className="text-left max-w-2xl mx-auto space-y-2 text-gray-600 dark:text-gray-300">
              <li>• Next.js 14 with App Router</li>
              <li>• TypeScript support</li>
              <li>• Static export for GitHub Pages</li>
              <li>• GitHub Actions deployment</li>
              <li>• Responsive design</li>
              <li>• Dark mode support</li>
            </ul>
          </div>
          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
} 