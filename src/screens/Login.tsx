import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Link as LinkIcon, ArrowRight } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (result.error) {
        throw new Error(result.error);
      }
      if (result.requirePasswordReset) {
        navigate('/reset-password', { state: { email, tempPassword: password, returnTo: '/login' } });
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Student Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0084B4] focus:border-transparent transition-all font-medium sm:text-sm"
                placeholder="student@school.edu"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-sm font-bold text-slate-700">
                Password
              </label>
              <Link to="/forgot-password" className="text-sm font-bold text-[#0084B4] hover:underline">
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-11 pr-11 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0084B4] focus:border-transparent transition-all font-medium sm:text-sm"
                placeholder="••••••••"
              />
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <LinkIcon className="h-4 w-4 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="flex items-center pt-1 pb-2">
            <input
              id="remember"
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 text-[#0084B4] focus:ring-[#0084B4]"
            />
            <label htmlFor="remember" className="ml-2 text-sm font-medium text-slate-600">
              Keep me signed in
            </label>
          </div>

          <button
            type="submit"
            className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[#0084B4] hover:bg-[#006A91] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0084B4] transition-all"
          >
            Sign In
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </form>
        {/*
        <div className="mt-8 bg-blue-50 p-4 rounded-xl border border-blue-100">
          <h3 className="text-sm font-bold text-blue-800 mb-2">Demo Credentials</h3>
          <div className="space-y-2 text-xs text-blue-700 font-medium">
            <div className="flex justify-between">
              <span>Student:</span>
              <code className="bg-white px-2 py-0.5 rounded">student@demo.com / password123</code>
            </div>
            <div className="flex justify-between">
              <span>Parent:</span>
              <code className="bg-white px-2 py-0.5 rounded">parent@demo.com / password123</code>
            </div>
            <div className="flex justify-between">
              <span>Admin:</span>
              <code className="bg-white px-2 py-0.5 rounded">admin@demo.com / admin</code>
            </div>
          </div>
        </div>
        */}

        <div className="mt-12 text-center text-xs font-medium text-slate-400 space-y-2">
          <p>© 2024 Vidhyapika Learning Solutions. All rights reserved.</p>
          <div className="flex justify-center gap-4">
            <a href="#" className="hover:text-slate-600">Privacy Policy</a>
            <span>•</span>
            <a href="#" className="hover:text-slate-600">Terms of Service</a>
            <span>•</span>
            <a href="#" className="hover:text-slate-600">Help Center</a>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
