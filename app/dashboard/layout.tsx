import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-background flex">
        <AppSidebar />
        <main className="flex-1 overflow-auto bg-background [padding-bottom:max(2.5rem,env(safe-area-inset-bottom,0px))]">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
