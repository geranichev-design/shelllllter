import { ApiError } from '../api';
import { getStoredAuth } from '../auth';
import { createDemoAuth, DEMO_DATA_KEY, demoAccounts } from './config';
import seed from './seed.json';

type User = { id: string; email: string; role: string; orgId: string | null };
type Organization = { id: string; name: string; type: string; parentId?: string | null };
type Request = {
  id: string; createdById: string; reviewedById: string | null;
  status: string; rejectionReason: string | null; reviewedAt: string | null;
  createdAt: string; updatedAt: string; data: Record<string, unknown>;
};
type Shelter = {
  id: string; name: string; type: string; accessType: string; capacity: number;
  latitude: number; longitude: number; status: string; accountingStatus: string;
  recordStatus: string; ownerOrgId: string; sourceRequestId: string | null;
  createdAt: string; updatedAt: string;
};
type State = { users: User[]; organizations: Organization[]; requests: Request[]; shelters: Shelter[] };

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
let memoryState: State | undefined;

function loadState(): State {
  try {
    const raw = window.localStorage.getItem(DEMO_DATA_KEY);
    if (raw) {
      const data = JSON.parse(raw) as State;
      if (['users', 'organizations', 'requests', 'shelters'].every(key => Array.isArray(data[key as keyof State]))) {
        return data;
      }
    }
  } catch { /* Sandboxed previews can block persistent storage. */ }
  return clone(memoryState ?? seed);
}

function saveState(state: State) {
  try {
    window.localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(state));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new ApiError('Недостатньо місця у браузері. Зменште розмір доданих фото.', 413);
    }
    // Keep the prototype usable for this tab when iframe storage is disabled.
  }
  memoryState = clone(state);
}

export function resetDemoData() {
  saveState(clone(seed));
}

const shelterTransitions: Record<string, string[]> = {
  NEED: ['PROJECT', 'OPERATION', 'DESTROYED'], PROJECT: ['CONSTRUCTION', 'DESTROYED'],
  CONSTRUCTION: ['OPERATION', 'DESTROYED'], OPERATION: ['MODERNIZATION', 'REPAIR', 'CONSERVATION', 'MISUSE', 'DESTROYED'],
  MODERNIZATION: ['OPERATION', 'DESTROYED'], REPAIR: ['OPERATION', 'DESTROYED'],
  CONSERVATION: ['REPAIR', 'DESTROYED'], MISUSE: ['DESTROYED'], DESTROYED: [],
};
const accountingTransitions: Record<string, string[]> = {
  NEW: ['IN_PROGRESS'], IN_PROGRESS: ['ACCOUNTED', 'REJECTED'], ACCOUNTED: ['IN_PROGRESS', 'REMOVED'], REMOVED: ['ACCOUNTED'], REJECTED: [],
};
const recordTransitions: Record<string, string[]> = {
  DRAFT: ['ACTIVE', 'DELETED'], ACTIVE: ['SUSPENDED', 'DELETED'], SUSPENDED: ['ACTIVE', 'DELETED'], DELETED: ['DRAFT'],
};

function assertTransition(current: string, next: unknown, transitions: Record<string, string[]>) {
  if (next !== undefined && next !== current && !transitions[current]?.includes(String(next))) {
    throw new ApiError('Цей перехід статусу недоступний.', 409);
  }
}

function assertRole(user: User, roles: string[]) {
  if (!roles.includes(user.role)) throw new ApiError('Недостатньо прав для виконання цієї дії.', 403);
}

function canViewRequest(request: Request, user: User) {
  return ['DSNS', 'REGIONAL'].includes(user.role) || request.createdById === user.id;
}

function requestView(state: State, request: Request) {
  return {
    ...request,
    createdBy: state.users.find(user => user.id === request.createdById),
    reviewedBy: state.users.find(user => user.id === request.reviewedById) ?? null,
    shelter: state.shelters.find(shelter => shelter.sourceRequestId === request.id) ?? null,
  };
}

function shelterView(state: State, shelter: Shelter) {
  const source = state.requests.find(request => request.id === shelter.sourceRequestId);
  const data = source?.data;
  return {
    ...shelter,
    address: data?.address ?? null,
    shelterNumber: [data?.accountNumber, data?.tempNumber, data?.technicalNumber, data?.buildingRegistryNumber]
      .find(value => typeof value === 'string' && value.trim()) ?? null,
    ownerOrg: state.organizations.find(org => org.id === shelter.ownerOrgId),
    sourceRequest: source ? requestView(state, source) : null,
    inspections: [],
  };
}

function validateShelterData(data: Record<string, unknown>, state: State) {
  if (typeof data.name !== 'string' || !data.name.trim()
    || !['STATIC', 'MOBILE'].includes(String(data.type))
    || !['PUBLIC', 'PRIVATE'].includes(String(data.accessType))
    || !Number.isInteger(data.capacity) || Number(data.capacity) <= 0
    || typeof data.latitude !== 'number' || !Number.isFinite(data.latitude) || Math.abs(data.latitude) > 90
    || typeof data.longitude !== 'number' || !Number.isFinite(data.longitude) || Math.abs(data.longitude) > 180
    || !state.organizations.some(org => org.id === data.ownerOrgId)) {
    throw new ApiError('Перевірте назву, тип, місткість, координати та організацію укриття.', 400);
  }
}

// Implements the existing UI's API contract entirely in the browser.
// No real tokens, credentials, network calls or database connections are used.
export async function demoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, 'https://demo.invalid');
  const parts = url.pathname.split('/').filter(Boolean);
  const method = (init?.method ?? 'GET').toUpperCase();
  const state = loadState();
  const user = getStoredAuth()?.user;
  if (!user) throw new ApiError('Демосесія недоступна.', 401);
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {};
  const now = new Date().toISOString();
  let result: unknown;

  if (method === 'POST' && url.pathname === '/auth/login') {
    const account = demoAccounts.find(account => account.email === body.email);
    if (!account) throw new ApiError('Оберіть один із демооблікових записів.', 401);
    result = createDemoAuth(account.role);
  } else if (method === 'GET' && url.pathname === '/auth/me') {
    result = { ...user, sub: user.id };
  } else if (method === 'GET' && url.pathname === '/organizations') {
    result = state.organizations;
  } else if (method === 'GET' && url.pathname === '/users') {
    result = state.users;
  } else if (parts[0] === 'shelters') {
    if (method === 'GET' && parts.length === 1) {
      result = state.shelters.map(shelter => shelterView(state, shelter));
    } else if (method === 'GET' && parts[1] === 'pending-verification') {
      assertRole(user, ['DSNS']);
      result = state.shelters.filter(shelter => shelter.status === 'NEED').map(shelter => shelterView(state, shelter));
    } else if (parts.length === 2 && ['GET', 'PATCH'].includes(method)) {
      const shelter = state.shelters.find(item => item.id === parts[1]);
      if (!shelter) throw new ApiError('Укриття не знайдено.', 404);
      if (method === 'PATCH') {
        assertTransition(shelter.status, body.status, shelterTransitions);
        assertTransition(shelter.accountingStatus, body.accountingStatus, accountingTransitions);
        assertTransition(shelter.recordStatus, body.recordStatus, recordTransitions);
        validateShelterData({ ...shelter, ...body }, state);
        const fields = ['name', 'type', 'accessType', 'capacity', 'latitude', 'longitude', 'ownerOrgId', 'status', 'accountingStatus', 'recordStatus'];
        Object.assign(shelter, Object.fromEntries(fields.filter(key => body[key] !== undefined).map(key => [key, body[key]])), { updatedAt: now });
        if (body.details && typeof body.details === 'object' && !Array.isArray(body.details)) {
          let source = state.requests.find(request => request.id === shelter.sourceRequestId);
          if (!source) {
            source = { id: crypto.randomUUID(), createdById: user.id, reviewedById: user.id, status: 'APPROVED', rejectionReason: null, reviewedAt: now, createdAt: now, updatedAt: now, data: { ...shelter } };
            state.requests.unshift(source);
            shelter.sourceRequestId = source.id;
          }
          source.data = { ...source.data, ...body.details };
          source.updatedAt = now;
        }
        saveState(state);
      }
      result = shelterView(state, shelter);
    }
  } else if (parts[0] === 'shelter-requests') {
    assertRole(user, ['BALANCE_HOLDER', 'GOV_ORG', 'REGIONAL', 'DSNS']);
    if (method === 'GET' && parts.length === 1) {
      result = state.requests.filter(request => canViewRequest(request, user)
        && (!url.searchParams.has('status') || request.status === url.searchParams.get('status')))
        .map(request => requestView(state, request));
    } else if (method === 'POST' && parts.length === 1) {
      assertRole(user, ['BALANCE_HOLDER', 'GOV_ORG', 'DSNS']);
      const data = { ...body, ownerOrgId: body.ownerOrgId ?? user.orgId };
      validateShelterData(data, state);
      const request: Request = { id: crypto.randomUUID(), createdById: user.id, reviewedById: null, status: 'NEW', rejectionReason: null, reviewedAt: null, createdAt: now, updatedAt: now, data };
      state.requests.unshift(request);
      saveState(state);
      result = requestView(state, request);
    } else if (parts.length >= 2) {
      const request = state.requests.find(item => item.id === parts[1]);
      if (!request) throw new ApiError('Пропозицію не знайдено.', 404);
      if (!canViewRequest(request, user)) throw new ApiError('Недостатньо прав для перегляду пропозиції.', 403);
      if (method === 'GET' && parts.length === 2) {
        result = requestView(state, request);
      } else if (method === 'PATCH' && parts.length === 3 && ['status', 'review'].includes(parts[2])) {
        assertRole(user, parts[2] === 'review' ? ['REGIONAL'] : ['REGIONAL', 'DSNS']);
        if (parts[2] === 'review' && request.status !== 'NEW') throw new ApiError('Розглядати можна лише нові пропозиції.', 409);
        if (parts[2] === 'review' && !['APPROVE', 'REJECT'].includes(String(body.decision))) throw new ApiError('Невідоме рішення.', 400);
        const status = parts[2] === 'review' ? (body.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED') : String(body.status);
        if (!['NEW', 'APPROVED', 'REJECTED'].includes(status)) throw new ApiError('Невідомий статус.', 400);
        if (request.status === 'APPROVED' && status !== 'APPROVED') throw new ApiError('Схвалену пропозицію не можна повернути на розгляд.', 409);
        if (status !== request.status) {
          if (status === 'REJECTED' && (typeof body.rejectionReason !== 'string' || !body.rejectionReason.trim())) throw new ApiError('Вкажіть причину відхилення.', 400);
          if (status === 'APPROVED') {
            validateShelterData(request.data, state);
            const data = request.data;
            state.shelters.unshift({ id: crypto.randomUUID(), name: String(data.name), type: String(data.type), accessType: String(data.accessType), capacity: Number(data.capacity), latitude: Number(data.latitude), longitude: Number(data.longitude), status: String(data.shelterStatus ?? 'NEED'), accountingStatus: String(data.accountingStatus ?? 'NEW'), recordStatus: String(data.recordStatus ?? 'DRAFT'), ownerOrgId: String(data.ownerOrgId), sourceRequestId: request.id, createdAt: now, updatedAt: now });
          }
          Object.assign(request, { status, rejectionReason: status === 'REJECTED' ? body.rejectionReason : null, reviewedById: status === 'NEW' ? null : user.id, reviewedAt: status === 'NEW' ? null : now, updatedAt: now });
          saveState(state);
        }
        result = requestView(state, request);
      }
    }
  }

  if (result === undefined) throw new ApiError('Ця дія недоступна у демоверсії.', 404);
  return clone(result) as T;
}
