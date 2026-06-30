import { useNavigate } from 'react-router-dom'
import LandingPageContent from '@/components/LandingPage'

function LandingPage() {
  const navigate = useNavigate()

  return (
    <LandingPageContent
      onAdminLogin={() => navigate('/admin-login')}
      onDriverLogin={() => navigate('/driver-login')}
    />
  )
}

export default LandingPage
