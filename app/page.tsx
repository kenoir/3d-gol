import dynamic from 'next/dynamic'

const GameOfLife3D = dynamic(() => import('../components/GameOfLife3D'), { ssr: false })

export default function Home() {
  return <GameOfLife3D />
} 