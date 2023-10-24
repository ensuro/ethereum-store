// Dashboard
import Dashboard from "../pages/Dashboard/dashboard";

const userRoutes = [
  { path: "/", component: Dashboard },

  // Not found page
  { path: "*", component: Dashboard },
];

const authRoutes = [];

export { userRoutes, authRoutes };
