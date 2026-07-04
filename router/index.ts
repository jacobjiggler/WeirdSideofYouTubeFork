import type { Express } from 'express';
import rootRoutes from './routes/root';
import apiRoutes from './routes/api';
import adminRoutes from './routes/admin';

// load the subrouters
function setupRouter(app: Express): void {
  app.use('/', rootRoutes);
  app.use('/api', apiRoutes);
  app.use('/admin', adminRoutes);
}

export = setupRouter;
