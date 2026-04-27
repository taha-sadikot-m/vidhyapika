import React from 'react';
import { Link } from 'react-router-dom';
import { AdminAuthLayout } from '../../components/AdminAuthLayout';
import { Mail, ArrowLeft } from 'lucide-react';

export function AdminForgotPassword() {
  return (
    <AdminAuthLayout>
      <div className="mb-10">
        <Link to="/admin/login" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Admin Login
        </Link>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Reset Admin Password</h2>
        <p className="text-slate-500 font-medium">Enter your admin email address and we'll send you a link to reset your password.</p>
      </div>

      <form className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-slate-700 block">Admin Email</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-slate-400" />
            </div>
            <input 
              type="email" 
              className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 sm:text-sm transition-all outline-none font-medium text-slate-900 placeholder:text-slate-400" 
              placeholder="admin@vidhyapika.edu" 
              required
            />
          </div>
        </div>

        <button 
          type="submit" 
          className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all mt-4"
        >
          Send Reset Link
        </button>
      </form>
    </AdminAuthLayout>
  );
}
