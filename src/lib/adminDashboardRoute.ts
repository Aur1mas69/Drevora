export const loadAdminDashboardPage = () => import('@/pages/AdminDashboardPage')

export function preloadAdminDashboardPage(): void {
  void loadAdminDashboardPage()
}
