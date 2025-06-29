import dynamic from 'next/dynamic'

const OverlayTest = dynamic(() => import('../../components/OverlayTest'), { ssr: false })

export default function TestPage() {
  return <OverlayTest />
}
