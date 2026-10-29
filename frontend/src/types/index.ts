export interface Meter {
  meterId: string;
  serialNumber?: string;
  manufacturer?: string;
  phaseType?: string;
  installationStatus?: string;
  distributionTransformerCode?: string;
  installationType?: string;
  build?: string;
}

export interface MeterGeo {
  latitude: number | null;
  longitude: number | null;
}

export interface ConsumptionReading {
  timestamp: string;
  rawTimestamp?: string;
  activeEnergyKwh: number | null;
  apparentEnergyKvah: number | null;
  voltageR: number | null;
}

export interface MeterComposite extends Meter {
  geo: MeterGeo | null;
  latestReading: ConsumptionReading | null;
}

export interface HierarchyNode {
  name: string;
  code: string;
}

export interface NetworkHierarchy {
  zone?: HierarchyNode;
  circle?: HierarchyNode;
  division?: HierarchyNode;
  subdivision?: HierarchyNode;
  substation?: HierarchyNode;
  feeder?: HierarchyNode;
  dt?: HierarchyNode;
}

export interface MeterNetwork {
  meterId: string;
  distributionTransformerCode: string | null;
  hierarchy: NetworkHierarchy | null;
  coordinates: MeterGeo | null;
}

export interface Transformer {
  code: string;
  name: string;
  feederCode: string;
  capacityKva: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'offline';
  timestamp: string;
  portal: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T, M = unknown> {
  data: T;
  meta?: M;
}

