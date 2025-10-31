import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Question } from '../types';
import { API_BASE_URL } from '../config';
import { useI18n } from '../i18n';

const AnswerQuestionsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchQuestions();
    }
  }, [id]);

  const fetchQuestions = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/offers/${id}/questions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setQuestions(data);
      } else {
        setError(t('answerQuestions.error.fetchFailed'));
      }
    } catch (err) {
      setError(t('answerQuestions.error.networkError'));
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedQuestion || !answer.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/questions/${selectedQuestion.id}/answer`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ answer: answer.trim() }),
      });

      if (response.ok) {
        setAnswer('');
        setSelectedQuestion(null);
        fetchQuestions(); // Refresh the questions
      } else {
        const data = await response.json();
        setError(data.error || t('answerQuestions.error.submitFailed'));
      }
    } catch (err) {
      setError(t('answerQuestions.error.networkError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-12 w-12 border-2 border-green-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="py-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('answerQuestions.back')}
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('answerQuestions.title')}
          </h1>
          <p className="text-gray-600">
            {t('answerQuestions.subtitle')}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Questions List */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {t('answerQuestions.questionsList')} ({questions.length})
            </h2>
            
            {questions.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500">{t('answerQuestions.noQuestions')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((question) => (
                  <div
                    key={question.id}
                    className={`bg-white rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedQuestion?.id === question.id 
                        ? 'border-green-500 ring-2 ring-green-200' 
                        : question.answer 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-red-200 bg-red-50'
                    }`}
                    onClick={() => setSelectedQuestion(question)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            question.answer 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {question.answer ? t('answerQuestions.answered') : t('answerQuestions.unanswered')}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(question.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-900 text-sm">{question.question}</p>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Answer Form */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {t('answerQuestions.answerForm')}
            </h2>
            
            {selectedQuestion ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="mb-6">
                  <h3 className="font-medium text-gray-900 mb-2">{t('answerQuestions.selectedQuestion')}</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-900">{selectedQuestion.question}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {t('answerQuestions.askedOn')} {new Date(selectedQuestion.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {selectedQuestion.answer ? (
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-900 mb-2">{t('answerQuestions.currentAnswer')}</h3>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <p className="text-gray-900">{selectedQuestion.answer}</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleAnswerSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-2">
                        {t('answerQuestions.yourAnswer')} *
                      </label>
                      <textarea
                        id="answer"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder={t('answerQuestions.answerPlaceholder')}
                        rows={6}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQuestion(null);
                          setAnswer('');
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        disabled={isSubmitting}
                      >
                        {t('form.cancel')}
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isSubmitting || !answer.trim()}
                      >
                        {isSubmitting ? t('form.submitting') : t('answerQuestions.submitAnswer')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500">{t('answerQuestions.selectQuestion')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnswerQuestionsPage;