import { createHashRouter } from "react-router-dom";
import { DashboardApp } from "./App";
import { HealthPage } from "../pages/HealthPage";
import { LogsPage } from "../pages/LogsPage";
import { OverviewPage } from "../pages/OverviewPage";
import { TopologyPage } from "../pages/TopologyPage";

export const router = createHashRouter([
  {
    path: "/",
    element: <DashboardApp />,
    children: [
      {
        index: true,
        element: <OverviewPage />,
      },
      {
        path: "topology",
        element: <TopologyPage />,
      },
      {
        path: "health",
        element: <HealthPage />,
      },
      {
        path: "logs",
        element: <LogsPage />,
      },
    ],
  },
]);
