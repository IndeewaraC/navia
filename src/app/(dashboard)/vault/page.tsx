import { createClient } from '@/src/lib/supabase/server';
import { redirect } from 'next/navigation';
import VaultClient from '@/src/components/vault/VaultClient';

export const metadata = {
  title: 'Vault | Navia',
  description: 'Stability Vault & Exempt Projects',
};

export default async function VaultPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  // Fetch the user's designated Emergency / Vault account
  const { data: vaultAccount } = await supabase
    .from('payment_accounts')
    .select('account_id, account_alias, current_balance')
    .eq('user_id', user.id)
    .ilike('account_alias', '%vault%')
    .limit(1)
    .single();

  // Fetch primary checking account (for funding projects)
  const { data: checkingAccount } = await supabase
    .from('payment_accounts')
    .select('account_id, current_balance')
    .eq('user_id', user.id)
    .ilike('account_alias', '%checking%')
    .limit(1)
    .single();

  // Fetch real exempt projects from the database
  const { data: activeProjects } = await supabase
    .from('exempt_projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  return (
    <VaultClient 
      vaultAccount={vaultAccount} 
      checkingAccount={checkingAccount}
      initialProjects={activeProjects || []} 
    />
  );
}
