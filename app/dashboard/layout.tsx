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
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background [padding-bottom:max(2.5rem,env(safe-area-inset-bottom,0px))]">
          <div className="mx-auto w-full max-w-[1700px]">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
