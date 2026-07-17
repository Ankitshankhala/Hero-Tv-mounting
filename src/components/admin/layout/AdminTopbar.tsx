import React from 'react';
import { Link } from 'react-router-dom';
import { Search, LogOut, User, ArrowLeft } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { NotificationBell } from '@/components/admin/NotificationBell';
import { StripeModeBadge } from '@/components/admin/StripeModeBadge';

const TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  bookings: 'Bookings',
  customers: 'Customers',
  workers: 'Workers',
  services: 'Services',
  coverage: 'Service Areas',
  reviews: 'Reviews',
  payments: 'Payments',
  invoices: 'Invoices',
  coupons: 'Coupons',
  tips: 'Tips',
  payroll: 'Payroll',
  sms: 'SMS Logs',
  email: 'Email Logs',
  blog: 'Blog',
  settings: 'Settings',
};

interface Props {
  activeTab: string;
  onSearchNavigate?: (tab: string) => void;
}

export const AdminTopbar = ({ activeTab }: Props) => {
  const { user, signOut } = useAuth();
  const initials = (user?.email || 'A').slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="h-full px-4 flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="h-5 w-px bg-border" />
        <h1 className="text-sm font-semibold text-foreground truncate">
          {TITLES[activeTab] || 'Admin'}
        </h1>

        <div className="flex-1 max-w-md mx-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-8 h-9 bg-muted/40 border-border focus-visible:bg-background"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StripeModeBadge />
          <NotificationBell />
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Site
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium">Signed in as</span>
                  <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/"><User className="h-4 w-4 mr-2" />Back to site</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
