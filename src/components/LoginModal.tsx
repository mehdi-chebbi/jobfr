import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { API_BASE_URL } from '../config';
import { useI18n } from '../i18n';

// Language-aware navigation hook
const useLanguageNavigate = () => {
  const navigate = useNavigate();
  const { currentLangPrefix } = useI18n();
  
  return (path: string, options?: any) => {
    const isAbsolute = path.startsWith('http');
    const languagePath = isAbsolute ? path : `${currentLangPrefix}${path === '/' ? '' : path}`;
    navigate(languagePath, options);
  };
};

const LoginModal = ({ isOpen, onClose, onLogin }: { isOpen: boolean; onClose: () => void; onLogin: (user: User) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { t } = useI18n();
  const langNavigate = useLanguageNavigate();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.token);
        onLogin(data.user);
        onClose();
        
        // Role-based redirects
        if (data.user.role === 'admin') {
          langNavigate('/admin-dashboard');
        } else if (data.user.role === 'comite_ajout') {
          langNavigate('/comite-ajout-dashboard');
        } else if (data.user.role === 'comite_ouverture') {
          langNavigate('/comite-ouverture-dashboard');
        } else {
          // Default redirect for other users (optional)
          langNavigate('/');
        }
      } else {
        setError(data.error || t('login.error.failed'));
      }
    } catch (err) {
      setError(t('login.error.network'));
    }
  };
  
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-gradient-to-br from-black/40 via-black/30 to-black/20 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 p-8 transform transition-all">
          <Dialog.Title className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-6 text-center">
            {t('login.title')}
          </Dialog.Title>
          {error && (
            <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-red-100 text-red-800 rounded-xl border border-red-200 shadow-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-800 mb-2">
                {t('login.email')}
              </label>
              <input
                type="email"
                id="email"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm bg-gray-50/50 focus:outline-none focus:ring-3 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200 hover:bg-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="mb-8">
              <label htmlFor="password" className="block text-sm font-semibold text-gray-800 mb-2">
                {t('login.password')}
              </label>
              <input
                type="password"
                id="password"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm bg-gray-50/50 focus:outline-none focus:ring-3 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200 hover:bg-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 active:bg-gray-300 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                {t('login.cancel')}
              </button>
              <button
                type="submit"
                className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-green-700 rounded-xl hover:from-green-700 hover:to-green-800 active:from-green-800 active:to-green-900 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {t('login.submit')}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default LoginModal;