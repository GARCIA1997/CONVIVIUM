import type { ApiModule } from "../lib/module.js";
import { approvalsModule } from "./approvals/routes.js";
import { auditModule } from "./audit/routes.js";
import { authModule } from "./auth/routes.js";
import { cashModule } from "./cash/routes.js";
import { catalogModule } from "./catalog/routes.js";
import { floorModule } from "./floor/routes.js";
import { inventoryModule } from "./inventory/routes.js";
import { ordersModule } from "./orders/routes.js";
import { purchasingModule } from "./purchasing/routes.js";
import { reportsModule } from "./reports/routes.js";
import { stationsModule } from "./stations/routes.js";
import { syncCloudModule } from "./sync/routes.js";
import { usersModule } from "./users/routes.js";
import { rolesModule } from "./roles/routes.js";
import { promotionsModule } from "./promotions/routes.js";

/** Registro central de módulos. Agregar un dominio = crear carpeta + añadirlo aquí. */
export const modules: ApiModule[] = [
  authModule,
  catalogModule,
  floorModule,
  ordersModule,
  stationsModule,
  approvalsModule,
  cashModule,
  inventoryModule,
  purchasingModule,
  reportsModule,
  auditModule,
  usersModule,
  rolesModule,
  promotionsModule,
  syncCloudModule,
];
