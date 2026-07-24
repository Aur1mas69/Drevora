import { useNavigate } from 'react-router-dom'
import LandingPageContent from '@/components/LandingPage'

function LandingPage() {
  const navigate = useNavigate()

  return (
    <LandingPageContent
      onAdminLogin={() => navigate('/login')}
      onWorkerLogin={() => navigate('/login')}
    />
  )
}

export default LandingPage
