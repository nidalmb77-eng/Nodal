import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Settings,
  ShieldCheck,
  Search,
  History,
  Calendar,
  Filter
} from 'lucide-react';
import { motion } from 'motion/react';
import { User, UserRole, Subscriber, ActivityLog } from '../types';

interface UserManagementProps {
  usersList: User[];
  currentUser: User;
  subscribers: Subscriber[];
  onAddUser: (user: Omit<User, 'id'>) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  activityLogs: ActivityLog[];
  onClearActivityLogs: () => void;
}

export default function UserManagement({
  usersList,
  currentUser,
  subscribers,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  activityLogs,
  onClearActivityLogs,
}: UserManagementProps) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [assignedSubscriberIds, setAssignedSubscriberIds] = useState<string[]>([]);
  const [createSearch, setCreateSearch] = useState('');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityUserFilter, setActivityUserFilter] = useState('all');
  const [activityActionFilter, setActivityActionFilter] = useState('all');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit states
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('operator');
  const [editAssignedSubscriberIds, setEditAssignedSubscriberIds] = useState<string[]>([]);
  const [editSearch, setEditSearch] = useState('');

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!username.trim() || !name.trim() || !password.trim()) {
      setError('يرجى ملء جميع الحقول المطلوبة لإنشاء الحساب الجديد.');
      return;
    }

    if (username.trim().length < 3) {
      setError('اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل.');
      return;
    }

    if (password.trim().length < 4) {
      setError('كلمة المرور يجب أن لا تقل عن 4 خانات.');
      return;
    }

    // Check unique username
    const exists = usersList.some(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase()
    );
    if (exists) {
      setError('اسم المستخدم هذا مستخدم بالفعل، يرجى اختيار اسم آخر.');
      return;
    }

    onAddUser({
      username: username.trim(),
      name: name.trim(),
      password: password.trim(),
      role,
      assignedSubscriberIds: role === 'admin' ? [] : assignedSubscriberIds,
    });

    setSuccess(`تم بنجاح إنشاء حساب المستخدم الجديد: ${name.trim()}`);
    setUsername('');
    setName('');
    setPassword('');
    setRole('operator');
    setAssignedSubscriberIds([]);
    setCreateSearch('');

    // Auto-clear success alert
    setTimeout(() => setSuccess(null), 4000);
  };

  const handleStartEdit = (user: User) => {
    setEditingUserId(user.id);
    setEditName(user.name);
    setEditUsername(user.username);
    setEditPassword(user.password || '');
    setEditRole(user.role);
    setEditAssignedSubscriberIds(user.assignedSubscriberIds || []);
    setEditSearch('');
    setError(null);
    setSuccess(null);
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditName('');
    setEditUsername('');
    setEditPassword('');
    setEditRole('operator');
    setEditAssignedSubscriberIds([]);
    setEditSearch('');
    setError(null);
  };

  const handleSaveEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!editName.trim() || !editUsername.trim() || !editPassword.trim()) {
      setError('يرجى ملء الاسم واسم المستخدم وكلمة المرور.');
      return;
    }

    if (editUsername.trim().length < 3) {
      setError('اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل.');
      return;
    }

    if (editPassword.trim().length < 4) {
      setError('كلمة المرور يجب أن لا تقل عن 4 خانات.');
      return;
    }

    // Check unique username
    const exists = usersList.some(
      (u) => u.id !== editingUserId && u.username.toLowerCase() === editUsername.trim().toLowerCase()
    );
    if (exists) {
      setError('اسم المستخدم هذا مستخدم بالفعل، يرجى اختيار اسم آخر.');
      return;
    }

    onUpdateUser({
      id: editingUserId!,
      name: editName.trim(),
      username: editUsername.trim(),
      password: editPassword.trim(),
      role: editRole,
      assignedSubscriberIds: editRole === 'admin' ? [] : editAssignedSubscriberIds,
    });

    setSuccess('تم تحديث بيانات وصلاحيات المستخدم بنجاح.');
    setEditingUserId(null);
    setEditName('');
    setEditUsername('');
    setEditPassword('');
    setEditRole('operator');
    setEditAssignedSubscriberIds([]);
    setEditSearch('');

    setTimeout(() => setSuccess(null), 4000);
  };

  const getRoleLabel = (r: UserRole) => {
    switch (r) {
      case 'admin':
        return { label: 'مدير النظام', color: 'text-rose-700 bg-rose-100 border-rose-200' };
      case 'operator':
        return { label: 'مدخل بيانات / محاسب', color: 'text-blue-700 bg-blue-100 border-blue-200' };
      case 'viewer':
        return { label: 'مشاهد فقط', color: 'text-slate-700 bg-slate-100 border-slate-200' };
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">إدارة المستخدمين وصلاحيات النظام</h2>
        <p className="text-base text-slate-500 font-bold mt-1">تحديد من يمكنه الوصول للنظام، ومستوى الصلاحيات المخولة لكل حساب مستخدم</p>
      </div>

      {/* Warning/Success Toasts */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-50 border-2 border-red-200 text-red-800 rounded-2xl flex items-center gap-3 font-bold text-sm"
        >
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-50 border-2 border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 font-bold text-sm"
        >
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{success}</span>
        </motion.div>
      )}

      {/* Grid Layout: Explanation of Roles and User Creation/Editing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Role Privileges Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border-2 border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              مستويات الصلاحيات المتاحة في النظام
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Admin privileges */}
              <div className="border-2 border-rose-100 bg-rose-50/20 rounded-2xl p-4 space-y-2">
                <span className="px-2.5 py-1 bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-black">
                  مدير النظام (Admin)
                </span>
                <ul className="text-xs text-slate-600 space-y-1.5 font-bold pt-1">
                  <li className="flex items-center gap-1.5 text-rose-800">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                    صلاحيات مطلقة كاملة
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                    إدارة المستخدمين والصلاحيات
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                    تغيير إعدادات العملة والتكلفة
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                    حذف الفواتير والدفعات والمشتركين
                  </li>
                </ul>
              </div>

              {/* Operator privileges */}
              <div className="border-2 border-blue-100 bg-blue-50/10 rounded-2xl p-4 space-y-2">
                <span className="px-2.5 py-1 bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-black">
                  مدخل بيانات / محاسب
                </span>
                <ul className="text-xs text-slate-600 space-y-1.5 font-bold pt-1">
                  <li className="flex items-center gap-1.5 text-blue-800">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                    إضافة/تعديل المشتركين والفواتير
                  </li>
                  <li className="flex items-center gap-1.5 text-blue-800">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                    تسجيل وتحصيل المبالغ والقبض
                  </li>
                  <li className="flex items-center gap-1.5 text-red-500">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                    يمنع من حذف السجلات الحيوية
                  </li>
                  <li className="flex items-center gap-1.5 text-red-500">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                    يمنع من دخول لوحة الإعدادات العامة
                  </li>
                </ul>
              </div>

              {/* Viewer privileges */}
              <div className="border-2 border-slate-100 bg-slate-50/50 rounded-2xl p-4 space-y-2">
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-black">
                  مشاهد فقط (Viewer)
                </span>
                <ul className="text-xs text-slate-600 space-y-1.5 font-bold pt-1">
                  <li className="flex items-center gap-1.5 text-slate-800">
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
                    تصفح لوحة التحكم الرئيسية
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                    استعراض وطباعة التقارير والكشوفات
                  </li>
                  <li className="flex items-center gap-1.5 text-red-500">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                    ممنوع من إضافة أي فواتير أو سداد
                  </li>
                  <li className="flex items-center gap-1.5 text-red-500">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                    ممنوع من أي تعديلات أو إعدادات
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Add or Edit Form Container */}
        <div className="bg-white border-2 border-slate-100 rounded-3xl p-6 shadow-sm">
          {editingUserId ? (
            <div>
              <div className="flex items-center justify-between mb-4 border-b pb-2 border-slate-100">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-600 animate-spin" />
                  تعديل حساب المستخدم
                </h3>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1 transition-colors cursor-pointer"
                >
                  إلغاء التعديل
                </button>
              </div>

              <form onSubmit={handleSaveEditSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-black text-slate-500">الاسم الكامل للموظف <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="مثال: أحمد المحاسب"
                    className="block w-full py-2.5 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-bold"
                  />
                </div>

                <div className="space-y-1 text-right">
                  <label className="block text-xs font-black text-slate-500">اسم المستخدم للدخول <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="مثال: ahmed_acc أو أحمد"
                    className="block w-full py-2.5 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-bold text-right"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-black text-slate-500">كلمة المرور <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full py-2.5 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-bold text-left font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-black text-slate-500">مستوى الصلاحية <span className="text-red-500">*</span></label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="block w-full py-2.5 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-bold"
                  >
                    <option value="operator">مدخل بيانات / محاسب</option>
                    <option value="viewer">مشاهد فقط (Viewer)</option>
                    <option value="admin">مدير نظام كامل (Admin)</option>
                  </select>
                </div>

                {/* Link Subscribers if not admin */}
                {editRole !== 'admin' && (
                  <div className="space-y-2 text-right">
                    <label className="block text-xs font-black text-slate-500">ربط بمشاهدة مشتركين محددين (اختياري)</label>
                    <div className="relative">
                      <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={editSearch}
                        onChange={(e) => setEditSearch(e.target.value)}
                        placeholder="البحث بالاسم أو رقم الاشتراك..."
                        className="w-full pr-9 pl-3 py-1.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:outline-none text-xs font-bold text-right"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditAssignedSubscriberIds(subscribers.map(s => s.id))}
                        className="text-[10px] text-blue-600 hover:underline font-extrabold"
                      >
                        تحديد الكل
                      </button>
                      <span className="text-slate-300 text-xs">|</span>
                      <button
                        type="button"
                        onClick={() => setEditAssignedSubscriberIds([])}
                        className="text-[10px] text-slate-500 hover:underline font-extrabold"
                      >
                        إلغاء التحديد
                      </button>
                    </div>

                    <div className="border-2 border-slate-100 rounded-xl p-3 bg-slate-50/50 max-h-40 overflow-y-auto space-y-2">
                      {subscribers.length > 0 ? (
                        subscribers
                          .filter(s => {
                            const q = editSearch.toLowerCase();
                            return s.name.toLowerCase().includes(q) || s.subNumber.toString().includes(q);
                          })
                          .map((sub) => {
                            const isChecked = editAssignedSubscriberIds.includes(sub.id);
                            return (
                              <label key={sub.id} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setEditAssignedSubscriberIds(editAssignedSubscriberIds.filter((id) => id !== sub.id));
                                    } else {
                                      setEditAssignedSubscriberIds([...editAssignedSubscriberIds, sub.id]);
                                    }
                                  }}
                                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>#{sub.subNumber} - {sub.name}</span>
                              </label>
                            );
                          })
                      ) : (
                        <div className="text-slate-400 text-xs font-bold py-1">لا يوجد مشتركين مضافين حالياً</div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold leading-normal pt-1">في حال عدم اختيار أي مشترك، سيتمكن الموظف من تصفح كافة الفواتير والعمليات لجميع المشتركين دون قيود.</p>
                  </div>
                )}

                {/* Inline error/success inside the Edit Card */}
                {error && (
                  <div className="p-3 bg-red-50 border-2 border-red-100 text-red-700 rounded-xl font-bold text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="p-3 bg-emerald-50 border-2 border-emerald-100 text-emerald-700 rounded-xl font-bold text-xs flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{success}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-black text-sm shadow-md shadow-blue-600/15 cursor-pointer transition-all duration-150"
                >
                  حفظ تعديلات الحساب
                </button>
              </form>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4 border-b pb-2 border-slate-100">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                إنشاء حساب مستخدم جديد
              </h3>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-black text-slate-500">الاسم الكامل للموظف <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: أحمد المحاسب"
                    className="block w-full py-2.5 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-bold"
                  />
                </div>

                <div className="space-y-1 text-right">
                  <label className="block text-xs font-black text-slate-500">اسم المستخدم للدخول <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="مثال: ahmed_acc أو أحمد"
                    className="block w-full py-2.5 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-bold text-right"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-black text-slate-500">كلمة المرور <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full py-2.5 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-bold text-left font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-black text-slate-500">مستوى الصلاحية <span className="text-red-500">*</span></label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="block w-full py-2.5 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-bold"
                  >
                    <option value="operator">مدخل بيانات / محاسب</option>
                    <option value="viewer">مشاهد فقط (Viewer)</option>
                    <option value="admin">مدير نظام كامل (Admin)</option>
                  </select>
                </div>

                {/* Link Subscribers if not admin */}
                {role !== 'admin' && (
                  <div className="space-y-2 text-right">
                    <label className="block text-xs font-black text-slate-500">ربط بمشاهدة مشتركين محددين (اختياري)</label>
                    <div className="relative">
                      <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={createSearch}
                        onChange={(e) => setCreateSearch(e.target.value)}
                        placeholder="البحث بالاسم أو رقم الاشتراك..."
                        className="w-full pr-9 pl-3 py-1.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:outline-none text-xs font-bold text-right"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAssignedSubscriberIds(subscribers.map(s => s.id))}
                        className="text-[10px] text-blue-600 hover:underline font-extrabold"
                      >
                        تحديد الكل
                      </button>
                      <span className="text-slate-300 text-xs">|</span>
                      <button
                        type="button"
                        onClick={() => setAssignedSubscriberIds([])}
                        className="text-[10px] text-slate-500 hover:underline font-extrabold"
                      >
                        إلغاء التحديد
                      </button>
                    </div>

                    <div className="border-2 border-slate-100 rounded-xl p-3 bg-slate-50/50 max-h-40 overflow-y-auto space-y-2">
                      {subscribers.length > 0 ? (
                        subscribers
                          .filter(s => {
                            const q = createSearch.toLowerCase();
                            return s.name.toLowerCase().includes(q) || s.subNumber.toString().includes(q);
                          })
                          .map((sub) => {
                            const isChecked = assignedSubscriberIds.includes(sub.id);
                            return (
                              <label key={sub.id} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setAssignedSubscriberIds(assignedSubscriberIds.filter((id) => id !== sub.id));
                                    } else {
                                      setAssignedSubscriberIds([...assignedSubscriberIds, sub.id]);
                                    }
                                  }}
                                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>#{sub.subNumber} - {sub.name}</span>
                              </label>
                            );
                          })
                      ) : (
                        <div className="text-slate-400 text-xs font-bold py-1">لا يوجد مشتركين مضافين حالياً</div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold leading-normal pt-1">في حال عدم اختيار أي مشترك، سيتمكن الموظف من تصفح كافة الفواتير والعمليات لجميع المشتركين دون قيود.</p>
                  </div>
                )}

                {/* Inline error/success inside the Create Card */}
                {error && (
                  <div className="p-3 bg-red-50 border-2 border-red-100 text-red-700 rounded-xl font-bold text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="p-3 bg-emerald-50 border-2 border-emerald-100 text-emerald-700 rounded-xl font-bold text-xs flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{success}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black text-sm shadow-md shadow-emerald-600/15 cursor-pointer transition-all duration-150"
                >
                  إنشاء حساب المستخدم
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Users Accounts List */}
      <div className="bg-white border-2 border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-600" />
          قائمة حسابات ومستخدمي النظام القائمة
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-100 text-slate-500">
                <th className="py-3 px-4 font-black">اسم المستخدم واللقب</th>
                <th className="py-3 px-4 font-black">اسم الدخول المعرف</th>
                <th className="py-3 px-4 font-black">مستوى الصلاحية والمستندات</th>
                <th className="py-3 px-4 font-black text-left">التحكم والعمليات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {usersList.map((user) => {
                const isEditing = editingUserId === user.id;
                const rStyle = getRoleLabel(user.role);

                return (
                  <tr key={user.id} className={`transition-colors ${isEditing ? 'bg-blue-50/20' : 'hover:bg-slate-50/50'}`}>
                    {/* Full Name */}
                    <td className="py-4 px-4 font-extrabold text-slate-800">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2 text-base">
                          {user.name}
                          {user.id === currentUser.id && (
                            <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-black">حسابك الحالي</span>
                          )}
                        </span>
                        <span className="text-xs text-slate-400 font-mono mt-0.5">كلمة المرور: {user.password || '••••'}</span>
                      </div>
                    </td>

                    {/* Username Identifier */}
                    <td className="py-4 px-4 font-mono font-bold text-slate-500">
                      @{user.username}
                    </td>

                    {/* Permission Badges & subscriber links */}
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <span className={`px-2.5 py-1 text-xs font-black border rounded-xl shadow-sm inline-block ${rStyle?.color}`}>
                          {rStyle?.label}
                        </span>
                        {user.role !== 'admin' && (
                          <div className="text-[10px] text-slate-500 font-bold mt-1">
                            {user.assignedSubscriberIds && user.assignedSubscriberIds.length > 0 ? (
                              <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                                مربوط بـ ({user.assignedSubscriberIds.length}) مشتركين محددين
                              </span>
                            ) : (
                              <span className="text-slate-400">جميع المشتركين (غير مقيد)</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Action buttons */}
                    <td className="py-4 px-4 text-left">
                      <div className="flex justify-end gap-3 items-center">
                        {/* Edit Credentials Trigger */}
                        <button
                          onClick={() => handleStartEdit(user)}
                          className={`text-xs font-black px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                            isEditing
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-50 hover:bg-slate-100 text-blue-600 border-slate-200 hover:border-blue-200'
                          }`}
                        >
                          تعديل الحساب
                        </button>

                        {/* Delete Account (with exceptions) */}
                        {user.username !== 'admin' && user.id !== currentUser.id ? (
                          <button
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من رغبتك في حذف حساب المستخدم: ${user.name}؟`)) {
                                onDeleteUser(user.id);
                                setSuccess(`تم حذف حساب المستخدم بنجاح.`);
                                setTimeout(() => setSuccess(null), 3000);
                              }
                            }}
                            className="text-rose-500 hover:text-rose-700 p-2 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                            title="حذف هذا الحساب"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs font-bold cursor-not-allowed" title="لا يمكن حذف الحسابات الأساسية أو الحالية">
                            غير قابل للحذف
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Log Section */}
      <div className="bg-white border-2 border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-800" />
              سجل النشاط الإداري والعمليات (Activity Log)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              براقب هذا السجل كافة العمليات الهامة التي قام بها المستخدمون لتعزيز الرقابة الإدارية ومتابعة التغييرات.
            </p>
          </div>
          {currentUser.role === 'admin' && (
            <button
              onClick={() => {
                if (confirm('هل أنت متأكد من رغبتك في تفريغ وحذف كافة سجلات النشاط؟ لا يمكن التراجع عن هذا الإجراء.')) {
                  onClearActivityLogs();
                }
              }}
              className="text-xs font-black text-rose-600 hover:text-white bg-white hover:bg-rose-600 border-2 border-rose-600 px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              تفريغ السجل بالكامل
            </button>
          )}
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute right-3 top-3.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث باسم المستخدم أو طبيعة العملية..."
              value={activitySearch}
              onChange={(e) => setActivitySearch(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border-2 border-slate-800 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all text-slate-700 text-right"
            />
          </div>

          {/* User Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <select
              value={activityUserFilter}
              onChange={(e) => setActivityUserFilter(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border-2 border-slate-800 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all text-slate-700"
            >
              <option value="all">كل مستخدمي النظام</option>
              {Array.from(new Set((activityLogs || []).map(log => JSON.stringify({ id: log.userId, name: log.userName })))).map(uStr => {
                const u = JSON.parse(uStr);
                return <option key={u.id} value={u.id}>{u.name}</option>;
              })}
            </select>
          </div>

          {/* Action type Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <select
              value={activityActionFilter}
              onChange={(e) => setActivityActionFilter(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border-2 border-slate-800 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all text-slate-700"
            >
              <option value="all">كل أنواع العمليات</option>
              {Array.from(new Set((activityLogs || []).map(log => log.action))).map(act => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Logs Timeline/List */}
        <div className="border-2 border-slate-800 rounded-2xl overflow-hidden bg-slate-50">
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-200">
            {(!activityLogs || activityLogs.length === 0) ? (
              <div className="p-8 text-center text-slate-500 text-xs font-bold">
                سجل النشاط فارغ حالياً. سيتم تسجيل أي عمليات جديدة هنا تلقائياً.
              </div>
            ) : (activityLogs.filter(log => {
              const matchesSearch = 
                log.userName.toLowerCase().includes(activitySearch.toLowerCase()) ||
                log.action.toLowerCase().includes(activitySearch.toLowerCase()) ||
                log.details.toLowerCase().includes(activitySearch.toLowerCase());
              
              const matchesUser = activityUserFilter === 'all' || log.userId === activityUserFilter;
              const matchesAction = activityActionFilter === 'all' || log.action === activityActionFilter;

              return matchesSearch && matchesUser && matchesAction;
            })).length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-bold">
                لا توجد سجلات نشاط مطابقة لمعايير البحث الحالية.
              </div>
            ) : (
              [...activityLogs.filter(log => {
                const matchesSearch = 
                  log.userName.toLowerCase().includes(activitySearch.toLowerCase()) ||
                  log.action.toLowerCase().includes(activitySearch.toLowerCase()) ||
                  log.details.toLowerCase().includes(activitySearch.toLowerCase());
                
                const matchesUser = activityUserFilter === 'all' || log.userId === activityUserFilter;
                const matchesAction = activityActionFilter === 'all' || log.action === activityActionFilter;

                return matchesSearch && matchesUser && matchesAction;
              })]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((log) => {
                  const isDelete = log.action.includes('حذف') || log.action.includes('تصفير') || log.action.includes('تفريغ');
                  const isCreate = log.action.includes('إضافة') || log.action.includes('إنشاء') || log.action.includes('إصدار') || log.action.includes('سداد');
                  const isUpdate = log.action.includes('تعديل') || log.action.includes('تغيير');
                  const isAuth = log.action.includes('دخول') || log.action.includes('خروج');

                  let actionColor = 'bg-slate-100 text-slate-800 border-slate-200';
                  if (isDelete) actionColor = 'bg-rose-50 text-rose-800 border-rose-100';
                  else if (isCreate) actionColor = 'bg-emerald-50 text-emerald-800 border-emerald-100';
                  else if (isUpdate) actionColor = 'bg-amber-50 text-amber-800 border-amber-100';
                  else if (isAuth) actionColor = 'bg-blue-50 text-blue-800 border-blue-100';

                  return (
                    <div key={log.id} className="p-4 flex flex-col md:flex-row md:items-start justify-between gap-3 hover:bg-white transition-all text-right">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* User Badge */}
                          <span className="text-xs font-black text-slate-800 flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            {log.userName}
                          </span>
                          
                          {/* Role Badge */}
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {log.userRole === 'admin' ? 'مدير' : log.userRole === 'operator' ? 'محاسب' : 'مشاهد'}
                          </span>

                          {/* Action Badge */}
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${actionColor}`}>
                            {log.action}
                          </span>
                        </div>

                        {/* Details */}
                        <p className="text-xs text-slate-700 leading-relaxed font-bold">
                          {log.details}
                        </p>
                      </div>

                      {/* Timestamp */}
                      <div className="text-[10px] text-slate-500 font-bold whitespace-nowrap self-end md:self-center bg-white px-2 py-1 rounded border border-slate-200 shadow-sm" dir="ltr">
                        {new Date(log.date).toLocaleString('ar-EG', {
                          year: 'numeric',
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
