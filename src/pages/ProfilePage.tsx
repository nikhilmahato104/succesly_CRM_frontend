import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Shield, 
  Calendar, 
  Edit, 
  Save,
  X,
  Lock,
  CheckCircle,
  Phone,
  Eye,
  EyeOff,
} from 'lucide-react';
import { DashboardLayout } from '../templates/DashboardLayout';
import { MyInput } from '../atoms/MyInput';
import { MyButton } from '../atoms/MyButton';
import { showToast } from '../atoms/MyToast';
import { formatDistanceToNow } from 'date-fns';
import { useSelector } from 'react-redux';
import { getData, patchData, postData } from '../services/crmServices';
import { selectAccessToken } from '../store/slices/authSlice';
import { selectUserData } from '../store/slices/userSlice';

export const ProfilePage: React.FC = () => {
  const authToken = useSelector(selectAccessToken);
  const userData  = useSelector(selectUserData);
  // compat shim — pages below still use cookies.uid / cookies.t variable names
  const cookies = { uid: userData.user_id, t: authToken };
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    country_code: '',
    role_id: '',
  });
  const [profileData, setProfileData] = useState<any>(null);
  const [roleName, setRoleName] = useState<string>(''); // Store role_name from API
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  // Fetch profile data and role name
  useEffect(() => {
    const fetchProfileAndRole = async () => {
      const userId = cookies.uid;
      const token = cookies.t;

      if (!userId || !token) {
        showToast.error('Authentication missing');
        return;
      }

      try {
        // Fetch user profile
        const userResponse = await getData({
          endpoint: 'crmAuth/getUserById',
          params: { id: userId },
          token,
        });

        if (userResponse?.data) {
          const data = userResponse.data;
          setProfileData(data);
          setFormData({
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
            country_code: data.country_code || '',
            role_id: data.role_id || '',
          });

          // Fetch role name if role_id exists
          if (data.role_id) {
            try {
              const roleResponse = await getData({
                endpoint: 'role/getRoleById',
                params: { id: data.role_id },
                token,
              });

              if (roleResponse?.data?.role_name) {
                setRoleName(roleResponse.data.role_name);
              } else {
                setRoleName('Unknown Role');
                showToast.error('Role name not found');
              }
            } catch (error) {
              console.error('Failed to fetch role name:', error);
              setRoleName('Unknown Role');
              showToast.error('Failed to load role name');
            }
          } else {
            setRoleName('No Role');
          }
        } else {
          showToast.error('No profile data found');
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        showToast.error('Failed to load profile');
      }
    };

    fetchProfileAndRole();
  }, [cookies.uid, cookies.t]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userId = cookies.uid;
      const token = cookies.t;

      if (!userId || !token) {
        showToast.error('Authentication missing');
        setIsLoading(false);
        return;
      }

      await patchData({
        endpoint: 'crmAuth/updateUser',
        params: { id: userId },
        data: { name: formData.name },
        token,
      });

      showToast.success('Profile updated successfully!');
      setIsEditing(false);

      if (profileData) {
        setProfileData({
          ...profileData,
          name: formData.name,
        });
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      showToast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (profileData) {
      setFormData({
        name: profileData.name || '',
        email: profileData.email || '',
        phone: profileData.phone || '',
        country_code: profileData.country_code || '',
        role_id: profileData.role_id || '',
      });
    }
    setIsEditing(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPasswordLoading(true);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast.error('Passwords do not match');
      setIsPasswordLoading(false);
      return;
    }

    try {
      const userId = cookies.uid;
      const token = cookies.t;

      if (!userId || !token) {
        showToast.error('Authentication missing');
        setIsPasswordLoading(false);
        return;
      }

      await postData({
        endpoint: 'crmAuth/changePassword',
        params: { 
          id: userId,
          password: passwordData.newPassword,
        },
        data: {},
        token,
      });

      showToast.success('Password updated successfully!');
      setPasswordData({ newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (error) {
      console.error('Failed to update password:', error);
      showToast.error('Failed to update password');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handlePasswordCancel = () => {
    setPasswordData({ newPassword: '', confirmPassword: '' });
    setShowPasswordForm(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const getInitials = (name: string) => {
    if (!name) return '';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'security', name: 'Security', icon: Lock },
  ];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 globalPadding">
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-8 text-gray-900 dark:text-white mb-8 overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center border border-purple-200 dark:border-purple-700 text-white text-2xl font-bold">
                  {getInitials(formData.name)}
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white dark:border-gray-800 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formData.name || 'User'}
                </h1>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formData.email || 'No Email'}
                </h2>
                <h3 className="text-md font-medium text-gray-600 dark:text-gray-400">
                  {roleName || 'No Role'}
                </h3>
              </div>
            </div>
            
            {activeTab === 'profile' && (
              <div className="mt-6 lg:mt-0 flex items-center space-x-4">
                {!isEditing ? (
                  <MyButton
                    onClick={() => setIsEditing(true)}
                    leftIcon={<Edit className="h-5 w-5" />}
                    className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                  >
                    Edit Profile
                  </MyButton>
                ) : (
                  <div className="flex space-x-3">
                    <MyButton
                      type="button"
                      variant="secondary"
                      onClick={handleCancel}
                      leftIcon={<X className="h-5 w-5" />}
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </MyButton>
                    <MyButton
                      onClick={handleSave}
                      isLoading={isLoading}
                      leftIcon={<Save className="h-5 w-5" />}
                      className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                    >
                      Save Changes
                    </MyButton>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-lg">Settings & Config</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Role</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {roleName || 'No Role'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Member since</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {profileData?.created_at ? formatDistanceToNow(new Date(profileData.created_at), { addSuffix: true }) : 'Recently'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</span>
                  <span className="flex items-center text-sm font-medium text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {profileData?.status || 'Active'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">Profile</h3>
              </div>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-3 w-full px-6 py-4 text-left transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-purple-50 dark:bg-purple-900/20 border-r-2 border-purple-500 text-purple-600 dark:text-purple-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span className="font-medium">{tab.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-8">
            {activeTab === 'profile' && (
              <>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Personal Information</h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                      Update your personal details
                    </p>
                  </div>
                  
                  <form onSubmit={handleSave} className="p-6">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Name
                        </label>
                        <MyInput
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          disabled={!isEditing}
                          placeholder="Nikhil"
                          className="bg-gray-50 dark:bg-gray-700"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Email Address
                        </label>
                        <MyInput
                          type="email"
                          value={formData.email}
                          disabled={true}
                          leftIcon={<Mail className="h-5 w-5 text-gray-400" />}
                          className="bg-gray-50 dark:bg-gray-700"
                        />
                      </div>

                      {/* <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Phone
                        </label>
                        <MyInput
                          type="text"
                          value={formData.phone || 'Not provided'}
                          disabled={true}
                          leftIcon={<Phone className="h-5 w-5 text-gray-400" />}
                          className="bg-gray-50 dark:bg-gray-700"
                        />
                      </div> */}

                      {/* <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Country Code
                        </label>
                        <MyInput
                          type="text"
                          value={formData.country_code || 'Not provided'}
                          disabled={true}
                          className="bg-gray-50 dark:bg-gray-700"
                        />
                      </div> */}
                    </div>
                  </form>
                </div>
              </>
            )}

            {activeTab === 'security' && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Security Settings</h2>
                <div className="space-y-6">
                  <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-xl">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Password</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Last changed 3 months ago</p>
                    {!showPasswordForm ? (
                      <MyButton
                        onClick={() => setShowPasswordForm(true)}
                        leftIcon={<Lock className="h-4 w-4" />}
                        className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                      >
                        Change Password
                      </MyButton>
                    ) : (
                      <form onSubmit={handlePasswordChange} className="space-y-4">
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            New Password
                          </label>
                          <MyInput
                            type={showNewPassword ? 'text' : 'password'}
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                            placeholder="Enter new password"
                            className="bg-gray-50 dark:bg-gray-700 pr-10"
                            leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          >
                            {showNewPassword ? (
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Confirm New Password
                          </label>
                          <MyInput
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            placeholder="Confirm new password"
                            className="bg-gray-50 dark:bg-gray-700 pr-10"
                            leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                        <div className="flex space-x-3">
                          <MyButton
                            type="button"
                            variant="secondary"
                            onClick={handlePasswordCancel}
                            leftIcon={<X className="h-5 w-5" />}
                            className="border-gray-300 text-gray-700 hover:bg-gray-50"
                          >
                            Cancel
                          </MyButton>
                          <MyButton
                            type="submit"
                            isLoading={isPasswordLoading}
                            leftIcon={<Save className="h-5 w-5" />}
                            // className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                          >
                            Save Password
                          </MyButton>
                        </div>
                      </form>
                    )}
                  </div>
                  
                
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};