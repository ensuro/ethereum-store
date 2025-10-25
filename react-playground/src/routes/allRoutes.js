import DynamicDashboard from "../pages/DynamicDashboard/dashboard";
import StaticDashboard from "../pages/StaticDashboard/staticDashboard";

const userRoutes = [
  { path: "/", component: DynamicDashboard },
  { path: "/static", component: StaticDashboard },

  // Not found page
  { path: "*", component: DynamicDashboard },
];

const authRoutes = [];

export { userRoutes, authRoutes };
