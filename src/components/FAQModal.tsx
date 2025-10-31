import { useState, useEffect } from 'react';
import type { FAQItem } from '../types';
import { API_BASE_URL } from '../config';
import { useI18n } from '../i18n';
import Swal from 'sweetalert2';

interface FAQModalProps {
  offerId: number;
  isOpen: boolean;
  onClose: () => void;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'comite_ajout' | 'comite_ouverture' | 'rh';
}

const FAQModal = ({ offerId, isOpen, onClose }: FAQModalProps) => {
  const { t } = useI18n();
  const [faqItems, setFaqItems] = useState<FAQItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAskForm, setShowAskForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get user from localStorage to determine role and check if offer is active
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

  useEffect(() => {
    if (isOpen && offerId) {
      fetchFAQ();
    }
  }, [isOpen, offerId]);

  const fetchFAQ = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/offers/${offerId}/faq`);
      
      if (response.ok) {
        const data = await response.json();
        setFaqItems(data);
      } else {
        setError(t('faq.error.fetchFailed'));
      }
    } catch (err) {
      setError(t('faq.error.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newQuestion.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: 'Validation Error',
        text: t('askQuestion.error.empty'),
        confirmButtonText: 'OK'
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/offers/${offerId}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: newQuestion.trim() }),
      });

      if (response.ok) {
        setNewQuestion('');
        setShowAskForm(false);
        // Show success message
        await Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: t('askQuestion.success'),
          confirmButtonText: 'Fermer'
        });
      } else {
        const errorData = await response.json();
        await Swal.fire({
          icon: 'error',
          title: 'Submission Failed',
          text: errorData.error || t('askQuestion.error.submitFailed'),
          confirmButtonText: 'OK'
        });
      }
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Network Error',
        text: t('askQuestion.error.networkError'),
        confirmButtonText: 'OK'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">{t('faq.title')}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-green-600 border-t-transparent rounded-full"></div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          ) : (
            <>
              {/* FAQ Section */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">{t('faq.question')}</h4>
                {faqItems.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-gray-500">{t('faq.noQuestions')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {faqItems.map((item, index) => (
                      <div key={index} className="border-l-4 border-green-500 bg-green-50 p-4 rounded-r-lg">
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-medium text-green-800 mb-1">{t('faq.question')}</p>
                            <p className="text-gray-900">{item.question}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-green-800 mb-1">{t('faq.answer')}</p>
                            <p className="text-gray-700">{item.answer}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ask Question Section */}
              <div className="border-t border-gray-200 pt-6">
                {!showAskForm ? (
                  <button
                    onClick={() => setShowAskForm(true)}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t('askQuestion.title')}
                  </button>
                ) : (
                  <form onSubmit={handleSubmitQuestion} className="space-y-4">
                    <div>
                      <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
                        {t('askQuestion.label')}
                      </label>
                      <textarea
                        id="question"
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={t('askQuestion.placeholder')}
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                      />
                    </div>
                    <div className="flex space-x-3">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {isSubmitting ? t('askQuestion.submitting') : t('askQuestion.submit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAskForm(false);
                          setNewQuestion('');
                        }}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                      >
                        {t('askQuestion.cancel')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}

          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              {t('faq.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQModal;