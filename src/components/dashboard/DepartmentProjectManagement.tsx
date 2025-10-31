import { useState, useEffect } from 'react';
import type { Department, Project } from '../../types';
import { API_BASE_URL } from '../../config';
import { useI18n } from '../../i18n';
import Swal from 'sweetalert2';

const DepartmentProjectManagement = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useI18n();

  // Form states
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [deptForm, setDeptForm] = useState({
    name: ''
  });

  const [projectForm, setProjectForm] = useState({
    name: '',
    department_id: ''
  });

  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    department: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const [deptResponse, projectResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/departments`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      if (deptResponse.ok) {
        const deptData = await deptResponse.json();
        setDepartments(deptData);
      }

      if (projectResponse.ok) {
        const projectData = await projectResponse.json();
        setProjects(projectData);
      }
    } catch (err) {
      setError(t('rh.error.loadData'));
    } finally {
      setIsLoading(false);
    }
  };

  // Department handlers
  const handleSaveDepartment = async () => {
    if (!deptForm.name.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: 'Validation Error',
        text: t('rh.validation.departmentNameRequired'),
        confirmButtonText: 'OK'
      });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingDept 
        ? `${API_BASE_URL}/departments/${editingDept.id}`
        : `${API_BASE_URL}/departments`;
      const method = editingDept ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deptForm),
      });

      if (response.ok) {
        await loadData();
        resetDeptForm();
        setShowDeptForm(false);
        setEditingDept(null);
      } else {
        const errorData = await response.json();
        await Swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: `${t('rh.error.saveDepartment')}: ${errorData.error}`,
          confirmButtonText: 'OK'
        });
      }
    } catch (err) {
      console.error('Error saving department:', err);
      await Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: t('rh.error.saveDepartment'),
        confirmButtonText: 'OK'
      });
    }
  };

  const handleEditDepartment = (dept: Department) => {
    setEditingDept(dept);
    setDeptForm({
      name: dept.name
    });
    setShowDeptForm(true);
  };

  const handleDeleteDepartment = async (id: number) => {
    const result = await Swal.fire({
      title: t('rh.confirm.deleteDepartment'),
      text: t('rh.confirm.deleteDepartment'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Supprimer',
      cancelButtonText: 'Annuler'
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/departments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        await loadData();
      } else {
        const errorData = await response.json();
        await Swal.fire({
          icon: 'error',
          title: 'Delete Failed',
          text: `${t('rh.error.deleteDepartment')}: ${errorData.error}`,
          confirmButtonText: 'OK'
        });
      }
    } catch (err) {
      console.error('Error deleting department:', err);
      await Swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: t('rh.error.deleteDepartment'),
        confirmButtonText: 'OK'
      });
    }
  };

  const resetDeptForm = () => {
    setDeptForm({ name: '' });
    setEditingDept(null);
  };

  // Project handlers
  const handleSaveProject = async () => {
    if (!projectForm.name.trim() || !projectForm.department_id) {
      await Swal.fire({
        icon: 'warning',
        title: 'Validation Error',
        text: t('rh.validation.projectNameAndDepartmentRequired'),
        confirmButtonText: 'OK'
      });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingProject 
        ? `${API_BASE_URL}/projects/${editingProject.id}`
        : `${API_BASE_URL}/projects`;
      const method = editingProject ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectForm),
      });

      if (response.ok) {
        await loadData();
        resetProjectForm();
        setShowProjectForm(false);
        setEditingProject(null);
      } else {
        const errorData = await response.json();
        await Swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: `${t('rh.error.saveProject')}: ${errorData.error}`,
          confirmButtonText: 'OK'
        });
      }
    } catch (err) {
      console.error('Error saving project:', err);
      await Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: t('rh.error.saveProject'),
        confirmButtonText: 'OK'
      });
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectForm({
      name: project.name,
      department_id: project.department_id.toString()
    });
    setShowProjectForm(true);
  };

  const handleDeleteProject = async (id: number) => {
    const result = await Swal.fire({
      title: t('rh.confirm.deleteProject'),
      text: t('rh.confirm.deleteProject'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Supprimer',
      cancelButtonText: 'Annuler'
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        await loadData();
      } else {
        const errorData = await response.json();
        await Swal.fire({
          icon: 'error',
          title: 'Échec de la suppression',
          text: `${t('rh.error.deleteProject')}: Impossible de supprimer un projet contenant des offres existantes.`,
          confirmButtonText: 'OK'
        });
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      await Swal.fire({
        icon: 'error',
        title: 'Échec de la suppression',
        text: t('rh.error.deleteProject'),
        confirmButtonText: 'OK'
      });
    }
  };

  const resetProjectForm = () => {
    setProjectForm({ name: '', department_id: '' });
    setEditingProject(null);
  };

  // Filter handlers
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      department: ''
    });
  };

  // Filter departments based on search and department filter
  const filteredDepartments = departments.filter(dept => {
    const deptProjects = projects.filter(p => p.department_id === dept.id);
    
    const matchesSearch = filters.search === '' || 
      dept.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      deptProjects.some(p => p.name.toLowerCase().includes(filters.search.toLowerCase()));
    
    const matchesDepartment = filters.department === '' || dept.id.toString() === filters.department;
    
    return matchesSearch && matchesDepartment;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-12 w-12 border-t-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('rh.management.title')}</h2>
          <p className="text-gray-600 mt-1">{t('rh.management.subtitle')}</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            {t('rh.statistics.departments')} {departments.length}
          </div>
          <div className="text-sm text-gray-600">
            {t('rh.statistics.projects')} {projects.length}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        </div>
      )}

      

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => {
            resetDeptForm();
            setShowDeptForm(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {t('rh.management.addDepartment')}
        </button>

        <button
          onClick={() => {
            resetProjectForm();
            setShowProjectForm(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          disabled={departments.length === 0}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {t('rh.management.addProject')}
        </button>
      </div>

      {/* Department Form */}
      {showDeptForm && (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            {editingDept ? t('rh.management.editDepartment') : t('rh.management.addNewDepartment')}
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('rh.management.nameRequired')}</label>
              <input
                type="text"
                value={deptForm.name}
                onChange={(e) => setDeptForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder={t('rh.management.enterDepartmentName')}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeptForm(false);
                  resetDeptForm();
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                {t('rh.management.cancel')}
              </button>
              <button
                onClick={handleSaveDepartment}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                {editingDept ? t('rh.management.update') : t('rh.management.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Form */}
      {showProjectForm && (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            {editingProject ? t('rh.management.editProject') : t('rh.management.addNewProject')}
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('rh.management.nameRequired')}</label>
              <input
                type="text"
                value={projectForm.name}
                onChange={(e) => setProjectForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder={t('rh.management.enterProjectName')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('rh.management.departmentRequired')}</label>
              <select
                value={projectForm.department_id}
                onChange={(e) => setProjectForm(prev => ({ ...prev, department_id: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">{t('rh.management.selectDepartment')}</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowProjectForm(false);
                  resetProjectForm();
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                {t('rh.management.cancel')}
              </button>
              <button
                onClick={handleSaveProject}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingProject ? t('rh.management.update') : t('rh.management.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Departments with Projects Listed Under Them */}
      {filteredDepartments.length === 0 ? (
        <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-3xl border border-gray-200">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('rh.noDepartmentsFound')}</h3>
          <p className="text-gray-600">{t('rh.noDepartmentsDescription')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredDepartments.map((dept) => {
            const deptProjects = projects.filter(p => p.department_id === dept.id);
            const filteredProjects = filters.search === '' 
              ? deptProjects 
              : deptProjects.filter(p => p.name.toLowerCase().includes(filters.search.toLowerCase()));
            
            return (
              <div key={dept.id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                {/* Department Header */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="bg-green-600 rounded-lg p-2">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{dept.name}</h3>
                          <p className="text-sm text-gray-600">{deptProjects.length} {t('rh.management.projectsLabel').toLowerCase()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditDepartment(dept)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteDepartment(dept.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={deptProjects.length > 0}
                        title={deptProjects.length > 0 ? t('rh.management.cannotDeleteDeptWithProjects') : ''}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Projects List */}
                <div className="p-6">
                  {filteredProjects.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p>{t('rh.management.noProjects')}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredProjects.map((project) => (
                        <div key={project.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 mb-1">{project.name}</h4>
                            </div>
                            <div className="flex space-x-1">
                              <button
                                onClick={() => handleEditProject(project)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteProject(project.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DepartmentProjectManagement;