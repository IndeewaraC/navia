'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProjectModal from './ProjectModal';
import FundProjectModal from './FundProjectModal';

interface Project {
  project_id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  icon: string;
}

interface VaultClientProps {
  vaultAccount: any;
  checkingAccount: any;
  initialProjects: Project[];
}

export default function VaultClient({ vaultAccount, checkingAccount, initialProjects }: VaultClientProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  
  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [fundProject, setFundProject] = useState<Project | null>(null);

  const handleProjectSaved = () => {
    router.refresh(); // Tell Next.js to re-fetch Server Components
    // We could manually update local state here, but a full refresh is safer for MVP
    window.location.reload(); 
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 selection:bg-indigo-500/30 relative">
      
      {/* Header Area */}
      <div className="px-6 pt-12 pb-6 sticky top-0 bg-slate-950/80 backdrop-blur-xl z-30 border-b border-slate-800/50">
        <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-blue-400">
          Stability Vault
        </h1>
        <p className="text-sm font-medium text-slate-400 mt-1">
          Long-Term Savings & Exempt Projects
        </p>
      </div>

      <div className="px-6 py-6 space-y-8">
        
        {/* Magic Month / Vault Balance */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
          
          <div className="flex flex-col gap-2 relative z-10">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Emergency Runway</span>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-extrabold text-indigo-400 tracking-tight">
                ${vaultAccount ? vaultAccount.current_balance.toFixed(2) : '0.00'}
              </span>
              <span className="text-sm font-medium text-slate-400 mb-1">secured</span>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              Your Magic Month surpluses and emergency funds are psychologically isolated here.
            </p>
          </div>
        </div>

        {/* Active Projects Grid */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 px-2 uppercase tracking-widest">Exempt Projects</h3>
          
          <div className="grid gap-4">
            {projects.length === 0 ? (
               <div className="bg-slate-950 border border-dashed border-slate-800 rounded-2xl p-8 text-center text-slate-500">
                 No exempt projects created yet.
               </div>
            ) : (
              projects.map((project) => {
                const progressPercentage = Math.min((project.saved_amount / project.target_amount) * 100, 100);
                
                return (
                  <div key={project.project_id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-indigo-500/30 transition-colors group relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-xl shadow-inner">
                          {project.icon}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-200">{project.name}</h4>
                          <p className="text-xs font-medium text-slate-500">{progressPercentage.toFixed(0)}% Funded</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-indigo-400">${project.saved_amount.toFixed(2)}</div>
                        <div className="text-xs text-slate-500 font-medium">/ ${project.target_amount.toFixed(2)}</div>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800/50 relative z-10 mb-4">
                      <div 
                        className="bg-indigo-500 h-2.5 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-1000 ease-out" 
                        style={{ width: `${progressPercentage}%` }}
                      ></div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 relative z-10">
                      <button 
                        onClick={() => setFundProject(project)}
                        className="flex-1 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-sm font-bold rounded-xl border border-indigo-500/20 transition-colors"
                      >
                        + Add Funds
                      </button>
                      <button 
                        onClick={() => setEditProject(project)}
                        className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-slate-400 text-sm font-bold rounded-xl border border-slate-800 transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <button 
            onClick={() => setIsCreateOpen(true)}
            className="w-full mt-4 flex items-center justify-center py-4 bg-slate-950 border border-dashed border-slate-700 rounded-2xl text-slate-400 font-bold hover:text-indigo-400 hover:border-indigo-500/50 transition-colors"
          >
            + Create New Project
          </button>
        </div>

      </div>

      {/* Modals */}
      {isCreateOpen && (
        <ProjectModal 
          onClose={() => setIsCreateOpen(false)} 
          onSuccess={handleProjectSaved}
        />
      )}

      {editProject && (
        <ProjectModal 
          project={editProject}
          onClose={() => setEditProject(null)} 
          onSuccess={handleProjectSaved}
        />
      )}

      {fundProject && (
        <FundProjectModal 
          project={fundProject}
          checkingAccount={checkingAccount}
          onClose={() => setFundProject(null)} 
          onSuccess={handleProjectSaved}
        />
      )}

    </div>
  );
}
