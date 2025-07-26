import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface UserRole {
  id: string;
  user_id: string;
  role: 'supplier' | 'vendor' | 'superadmin';
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name?: string;
  company_name?: string;
  business_name?: string;
  business_type?: string;
  business_address?: string;
  contact_number?: string;
  fssai_license?: string;
  other_certifications?: string[];
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user role and profile data
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setUserRole(null);
          setUserProfile(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      setUserRole(roleData);
      setUserProfile(profileData);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  };

  const signUp = async (email: string, password: string, userData: any) => {
    const redirectUrl = `${window.location.origin}/`;
    
    // Check if this is the hardcoded superadmin
    const isHardcodedSuperadmin = email.toLowerCase() === 'fieronrhys@gmail.com';
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: userData
      }
    });

    if (!error) {
      // After successful signup, create user role and profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Determine role - hardcoded superadmin gets superadmin role regardless of selection
        const finalRole = isHardcodedSuperadmin ? 'superadmin' : userData.role;
        
        // Insert user role
        await supabase.from('user_roles').insert({
          user_id: user.id,
          role: finalRole,
          approval_status: (finalRole === 'supplier' && !isHardcodedSuperadmin) ? 'pending' : 'approved'
        });

        // Update profile with additional data
        await supabase.from('profiles').update({
          full_name: isHardcodedSuperadmin ? 'Admin' : userData.full_name,
          company_name: userData.company_name,
          business_name: userData.business_name,
          business_type: userData.business_type,
          business_address: userData.business_address,
          contact_number: userData.contact_number,
          fssai_license: userData.fssai_license,
          other_certifications: userData.other_certifications
        }).eq('user_id', user.id);
      }
    }

    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setSession(null);
      setUserRole(null);
      setUserProfile(null);
    }
    return { error };
  };

  const isAuthenticated = !!user;
  const isApproved = userRole?.approval_status === 'approved' || userRole?.role !== 'supplier';
  
  return {
    user,
    session,
    userRole,
    userProfile,
    loading,
    isAuthenticated,
    isApproved,
    signIn,
    signUp,
    signOut,
    fetchUserData
  };
};