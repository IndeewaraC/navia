'use client';

import { useState } from 'react';

interface Project {
  project_id?: string;
  name: string;
  target_amount: number;
  icon: string;
}

interface ProjectModalProps {
  project?: Project; // If provided, we are editing
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProjectModal({ project, onClose, onSuccess }: ProjectModalProps) {
  const [name, setName] = useState(project?.name || '');
  const [target, setTarget] = useState(project?.target_amount ? project.target_amount.toString() : '');
  const [icon, setIcon] = useState(project?.icon || '🎯');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!project;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const targetAmount = parseFloat(target);
    if (isNaN(targetAmount) || targetAmount <= 0) {
      setError('Target amount must be a positive number');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/vault/projects', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project?.project_id,
          name,
          target_amount: targetAmount,
          icon
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save project');

      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
        
        <h2 className="text-xl font-bold text-slate-100 mb-6 relative z-10">
          {isEdit ? 'Edit Project' : 'Create New Project'}
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Project Name</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="e.g. Car Maintenance"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Goal ($)</label>
              <input 
                type="number" 
                step="0.01"
                value={target}
                onChange={e => setTarget(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Emoji Icon</label>
              <input 
                type="text" 
                value={icon}
                onChange={e => setIcon(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors text-center text-xl"
                placeholder="🎯"
                maxLength={2}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-400 bg-slate-950 border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-100 bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
