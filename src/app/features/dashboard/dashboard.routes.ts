import { FeedingRepository } from '../feeding/infrastructure/feeding-repository';
import { FinanceRepository } from '../finance/infrastructure/finance-repository';
import { ExitRepository } from '../exits/infrastructure/exit-repository';
import { BreedingRepository } from '../breeding/infrastructure/breeding-repository';
import { HealthRepository } from '../health/infrastructure/health-repository';
import { WeightRepository } from '../weights/infrastructure/weight-repository';
import { Routes } from '@angular/router';
import { dashboardNavigation } from '../../shared/ui/sidebar/navigation';
import { ANIMAL_PROVIDERS } from '../animals/infrastructure/animal-repository';
import { ORGANIZATION_PROVIDERS } from '../organization/infrastructure/organization-repository';
import { ACCESS_PROVIDERS } from '../users/infrastructure/access-repository';

export const dashboardRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./presentation/pages/dashboard/dashboard').then((m) => m.Dashboard),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'profile',
        title: 'Mi perfil | Pelifolk',
        loadComponent: () => import('../profile/profile').then((m) => m.Profile),
      },
      { path: 'management-decisions', title: 'Decisiones vigentes | Pelifolk', loadComponent: () => import('../animals/presentation/decision-board').then(m => m.DecisionBoard) },
      {
        path: 'physical-evaluations',
        title: 'Evaluaciones físicas | Pelifolk',
        loadComponent: () =>
          import('../animals/presentation/physical-list').then((m) => m.PhysicalList),
      },
      {
        path: 'animals',
        title: 'Animales | Pelifolk',
        providers: ANIMAL_PROVIDERS,
        loadComponent: () =>
          import('../animals/presentation/animal-list').then((m) => m.AnimalList),
      },
      {
        path: 'genealogy',
        title: 'Genealogía | Pelifolk',
        loadComponent: () => import('../animals/presentation/genealogy').then((m) => m.Genealogy),
      },
      {
        path: 'genealogy/:id',
        title: 'Genealogía | Pelifolk',
        loadComponent: () => import('../animals/presentation/genealogy').then((m) => m.Genealogy),
      },
      {
        path: 'breeds',
        title: 'Razas | Pelifolk',
        providers: ANIMAL_PROVIDERS,
        loadComponent: () => import('../animals/presentation/breed-list').then((m) => m.BreedList),
      },
      {
        path: 'locations/movements',
        title: 'Ubicación y traslados | Pelifolk',
        loadComponent: () =>
          import('../organization/presentation/movements').then((m) => m.Movements),
      },
      {
        path: 'locations',
        title: 'Ubicaciones | Pelifolk',
        providers: ORGANIZATION_PROVIDERS,
        loadComponent: () =>
          import('../organization/presentation/location-list').then((m) => m.LocationList),
      },
      {
        path: 'groups',
        title: 'Lotes | Pelifolk',
        providers: ORGANIZATION_PROVIDERS,
        loadComponent: () =>
          import('../organization/presentation/group-list').then((m) => m.GroupList),
      },
      {
        path: 'groups/:id',
        title: 'Animales del lote | Pelifolk',
        providers: ORGANIZATION_PROVIDERS,
        loadComponent: () =>
          import('../organization/presentation/group-detail').then((m) => m.GroupDetail),
      },
      {
        path: 'management/weanings',
        title: 'Destetes | Pelifolk',
        loadComponent: () => import('../weaning/weaning-list').then((m) => m.WeaningList),
      },
      {
        path: 'management/comparison',
        title: 'Comparar pesos | Pelifolk',
        providers: [WeightRepository],
        loadComponent: () => import('../weights/presentation/weight-comparison').then(m => m.WeightComparison),
      },
      {
        path: 'management',
        title: 'Pesajes | Pelifolk',
        providers: [WeightRepository],
        loadComponent: () =>
          import('../weights/presentation/weight-list').then((m) => m.WeightList),
      },
      {
        path: 'health',
        title: 'Sanidad | Pelifolk',
        providers: [HealthRepository],
        loadComponent: () => import('../health/presentation/health-list').then((m) => m.HealthList),
      },
      { path: 'health/ingredients', title: 'Principios activos | Pelifolk', providers: [HealthRepository], loadComponent: () => import('../health/presentation/ingredient-list').then(m=>m.IngredientList) },
      {
        path: 'health/products',
        title: 'Productos | Pelifolk',
        providers: [HealthRepository],
        loadComponent: () =>
          import('../health/presentation/product-list').then((m) => m.ProductList),
      },
      {
        path: 'health/reactions',
        title: 'Alergias y reacciones | Pelifolk',
        loadComponent: () =>
          import('../health/presentation/reaction-list').then((m) => m.ReactionList),
      },
      {
        path: 'health/incidents',
        title: 'Incidentes | Pelifolk',
        loadComponent: () =>
          import('../health/presentation/incident-list').then((m) => m.IncidentList),
      },
      {
        path: 'health/reviews',
        title: 'Revisiones clínicas | Pelifolk',
        loadComponent: () => import('../health/presentation/review-list').then((m) => m.ReviewList),
      },
      {
        path: 'health/withdrawals',
        title: 'Retiro sanitario | Pelifolk',
        loadComponent: () =>
          import('../health/presentation/withdrawal-list').then((m) => m.WithdrawalList),
      },
      {
        path: 'health/programs',
        title: 'Programas sanitarios | Pelifolk',
        providers: [HealthRepository],
        loadComponent: () =>
          import('../health/presentation/program-list').then((m) => m.ProgramList),
      },
      {
        path: 'breeding/assessments',
        title: 'Evaluaciones maternas y de crías | Pelifolk',
        loadComponent: () =>
          import('../breeding/presentation/assessment-list').then((m) => m.AssessmentList),
      },
      {
        path: 'breeding/indicators',
        title: 'Indicadores reproductivos | Pelifolk',
        loadComponent: () =>
          import('../breeding/presentation/indicators').then((m) => m.Indicators),
      },
      {
        path: 'breeding/performance',
        title: 'Desempeño de reproductores | Pelifolk',
        loadComponent: () =>
          import('../breeding/presentation/performance').then((m) => m.Performance),
      },
      {
        path: 'breeding/upcoming-births',
        title: 'Partos próximos | Pelifolk',
        providers: [BreedingRepository],
        loadComponent: () =>
          import('../breeding/presentation/upcoming-births').then((m) => m.UpcomingBirths),
      },
      {
        path: 'breeding',
        title: 'Reproducción | Pelifolk',
        providers: [BreedingRepository],
        loadComponent: () =>
          import('../breeding/presentation/breeding-list').then((m) => m.BreedingList),
      },
      {
        path: 'exits',
        title: 'Salidas | Pelifolk',
        providers: [ExitRepository],
        loadComponent: () => import('../exits/presentation/exit-list').then((m) => m.ExitList),
      },
      { path: 'finance/profitability',title: 'Resultado por animal | Pelifolk',loadComponent: ()=>import('../finance/presentation/profitability').then(m=>m.Profitability) },
      {
        path: 'finance/costs',
        title: 'Costos por animal o lote | Pelifolk',
        loadComponent: () => import('../finance/presentation/costs').then((m) => m.Costs),
      },
      {
        path: 'finance',
        title: 'Economía | Pelifolk',
        providers: [FinanceRepository],
        loadComponent: () =>
          import('../finance/presentation/finance-list').then((m) => m.FinanceList),
      },
      {
        path: 'feeding',
        title: 'Alimentación | Pelifolk',
        providers: [FeedingRepository],
        loadComponent: () =>
          import('../feeding/presentation/feeding-list').then((m) => m.FeedingList),
      },
      { path: 'ranches', pathMatch: 'full', redirectTo: 'locations' },
      {
        path: 'users',
        title: 'Usuarios | Pelifolk',
        providers: ACCESS_PROVIDERS,
        loadComponent: () =>
          import('../users/presentation/pages/user-list/user-list').then((m) => m.UserList),
      },
      {
        path: 'roles',
        title: 'Roles y permisos | Pelifolk',
        providers: ACCESS_PROVIDERS,
        loadComponent: () =>
          import('../users/presentation/pages/role-list/role-list').then((m) => m.RoleList),
      },
      {
        path: 'audit',
        title: 'Auditoría | Pelifolk',
        loadComponent: () => import('../audit/presentation/audit-list').then((m) => m.AuditList),
      },
      {
        path: 'reports',
        title: 'Reportes | Pelifolk',
        loadComponent: () => import('../reports/report-home').then((m) => m.ReportHome),
      },
      {
        path: 'overview',
        title: 'Resumen | Pelifolk',
        loadComponent: () =>
          import('./presentation/pages/overview/overview').then((m) => m.Overview),
      },
      ...dashboardNavigation
        .filter(
          (item) =>
            ![
              'overview',
              'reports',
              'audit',
              'users',
              'roles',
              'animals',
              'breeds',
              'genealogy',
              'locations',
              'groups',
              'management',
              'breeding',
              'exits',
              'finance',
              'feeding',
              'health',
            ].includes(item.path),
        )
        .map((item) => ({
          path: item.path,
          title: `${item.label} | Pelifolk`,
          data: { title: item.label, description: item.description },
          loadComponent: () =>
            import('../../shared/ui/section-placeholder/section-placeholder').then(
              (m) => m.SectionPlaceholder,
            ),
        })),
      { path: '**', redirectTo: 'overview' },
    ],
  },
];
