import React from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminSideNav } from './AdminSideNav';
import { AdminTopbar } from './AdminTopbar';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const AdminLayout = ({ activeTab, onTabChange, children }: Props) => {
  return (
    <SidebarProvider
      defaultOpen
      style={{
        '--sidebar-width': '15rem',
        '--sidebar-width-icon': '3.25rem',
      } as React.CSSProperties}
    >
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSideNav activeTab={activeTab} onTabChange={onTabChange} />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminTopbar activeTab={activeTab} />
          <main className="flex-1 overflow-auto">
            <div className="p-6 max-w-[1600px] mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
