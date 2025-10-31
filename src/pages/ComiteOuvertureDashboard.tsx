import ApplicationsSummary from '../components/dashboard/ApplicationsSummary';
import { useI18n } from '../i18n';
import type { User } from '../types';

const ComiteOuvertureDashboard = () => {
  const { t } = useI18n();
  
  // Get user from localStorage to determine role
  const getUser = (): User | null => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      return {
        id: decoded.id,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role,
      };
    } catch {
      return null;
    }
  };
  
  const user = getUser();
  
  // This dashboard is specifically for Comité d'ouverture
  // They can see all applications, not just archivable ones
  return (
    <div className="py-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('comite_ouverture.dashboard.title')}
          </h1>
          <p className="text-gray-600">
            {t('comite_ouverture.dashboard.subtitle')}
          </p>
        </div>
        
        {/* Applications Section */}
        <ApplicationsSummary showAllOffers={true} />
      </div>
    </div>
  );
};

export default ComiteOuvertureDashboard;